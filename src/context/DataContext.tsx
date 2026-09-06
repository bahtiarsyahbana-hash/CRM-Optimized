import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Deal, Claim, ClaimStatus, Endorsement, HistoryLog, DealStage, DealType, Client,
  DealApprovalAction, DealApprovalLogEntry, DealApprovalStatus, DealStageLogEntry,
  MasterPolicy, RatingRule, AppUser, UserRole, Insurer, InsurerMigrationReport,
  CatalogueItem, CatalogueKind, CatalogueSeedReport, PRODUCT_TYPES,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  JANUARY_ACTUAL_CLIENTS,
  normalizePrimaryClientName,
} from '../data/januaryActualClients';
import { INSURANCE_COMPANIES } from '../constants/insuranceCompanies';
import { deriveInsurerCode, uniqueInsurerCode, matchInsurerByName } from '../utils/insurers';
import { deriveCatalogueCode, uniqueCatalogueCode } from '../utils/catalogue';

const JANUARY_CLIENT_IMPORT_KEY = 'iris_january_2026_actual_clients_v1';
const INSURER_MIGRATION_KEY = 'iris_insurer_catalogue_v1';
const CATALOGUE_SEED_KEY = 'iris_catalogues_v1';

/** Built-in Lines of Business — the union literals that predate the catalogue. */
const BUILT_IN_LOB = ['Manufacture', 'Trading', 'Financial Institution', 'Property', 'Individual', 'Others'];

function buildCatalogue(names: string[], category: string): CatalogueItem[] {
  const now = new Date().toISOString();
  const taken = new Set<string>();
  return names.map(name => {
    const code = uniqueCatalogueCode(deriveCatalogueCode(name), taken);
    taken.add(code);
    return {
      id: uuidv4(), name, category, code,
      active: true, createdAt: now, updatedAt: now,
    };
  });
}

/**
 * Seed the three catalogues once.
 *
 * Products come from PRODUCT_TYPES. Lines of Business come from the built-in
 * literals *plus* any value already sitting on a client — LineOfBusiness is an
 * open union that accepts any string, so real data is where the fragmentation
 * actually lives and dropping it would lose classifications. Benefits seed
 * empty: nothing models them today, and seeding from SOC coverage templates
 * would prejudge the reconciliation that is deliberately deferred.
 */
function seedCatalogues(clients: Client[]) {
  const now = new Date().toISOString();

  const products = buildCatalogue([...PRODUCT_TYPES], 'Insurance Product');

  const fromData = [...new Set(
    clients.map(c => (c.lineOfBusiness || '').trim()).filter(Boolean),
  )];
  const discovered = fromData.filter(
    v => !BUILT_IN_LOB.some(b => b.toLowerCase() === v.toLowerCase()),
  );
  const linesOfBusiness = buildCatalogue([...BUILT_IN_LOB, ...discovered], 'Industry Sector');

  const benefits: CatalogueItem[] = [];

  const reports: CatalogueSeedReport[] = [
    { kind: 'products', ranAt: now, seeded: products.length, discoveredFromData: [] },
    { kind: 'benefits', ranAt: now, seeded: 0, discoveredFromData: [] },
    { kind: 'linesOfBusiness', ranAt: now, seeded: linesOfBusiness.length, discoveredFromData: discovered },
  ];

  return { products, benefits, linesOfBusiness, reports };
}

/**
 * Seed the insurer catalogue from the constant that used to be the only source,
 * then backfill `insurerId` onto every deal and master policy by exact name
 * match.
 *
 * Anything that does not match keeps its `insuranceCompany` string and is
 * listed in the report rather than being silently left null — an unmatched
 * record is a deal whose commission rate can no longer be resolved from its
 * insurer, which is worth seeing.
 */
function seedInsurersAndBackfill(deals: Deal[], masterPolicies: MasterPolicy[]) {
  const now = new Date().toISOString();
  const taken = new Set<string>();

  const insurers: Insurer[] = INSURANCE_COMPANIES.map(name => {
    const code = uniqueInsurerCode(deriveInsurerCode(name), taken);
    taken.add(code);
    return {
      id: uuidv4(),
      name,
      code,
      contacts: [],
      documents: [],
      active: true,
      createdAt: now,
      updatedAt: now,
    };
  });

  const dealsUnmatched: InsurerMigrationReport['dealsUnmatched'] = [];
  const mpUnmatched: InsurerMigrationReport['masterPoliciesUnmatched'] = [];
  let dealsMatched = 0;
  let mpMatched = 0;

  const reasonFor = (name?: string) =>
    !name || !name.trim() ? 'No insurer recorded on the record'
      : name.trim() === 'Other' ? 'Recorded as "Other" — the picker\'s free-text escape hatch'
      : 'Name is not in the seeded catalogue';

  const nextDeals = deals.map(d => {
    if (d.insurerId) return d;
    const match = matchInsurerByName(insurers, d.insuranceCompany);
    if (match) { dealsMatched++; return { ...d, insurerId: match.id }; }
    if (d.insuranceCompany) {
      dealsUnmatched.push({ id: d.id, insuranceCompany: d.insuranceCompany, reason: reasonFor(d.insuranceCompany) });
    }
    return d;
  });

  const nextMasterPolicies = masterPolicies.map(mp => {
    if (mp.insurerId) return mp;
    const match = matchInsurerByName(insurers, mp.insuranceCompany);
    if (match) { mpMatched++; return { ...mp, insurerId: match.id }; }
    if (mp.insuranceCompany) {
      mpUnmatched.push({
        id: mp.id, policyNumber: mp.policyNumber,
        insuranceCompany: mp.insuranceCompany, reason: reasonFor(mp.insuranceCompany),
      });
    }
    return mp;
  });

  const report: InsurerMigrationReport = {
    ranAt: now,
    seededInsurers: insurers.length,
    dealsTotal: deals.length,
    dealsMatched,
    dealsUnmatched,
    masterPoliciesTotal: masterPolicies.length,
    masterPoliciesMatched: mpMatched,
    masterPoliciesUnmatched: mpUnmatched,
  };

  return { insurers, deals: nextDeals, masterPolicies: nextMasterPolicies, report };
}

/**
 * Migrate legacy claims to the new ClaimStatus values + dateRegistered field.
 * Old claims had statuses: 'Reported' | 'Assessing' | 'Approved' | 'Declined' and dateFiled.
 */
const LEGACY_STATUS_MAP: Record<string, ClaimStatus> = {
  'Reported': 'Claim Registered',
  'Assessing': 'Under Assessment',
  'Approved': 'Approved',
  'Declined': 'Reject',
};

function migrateClaims(rawClaims: any[]): Claim[] {
  return rawClaims.map(c => ({
    ...c,
    status: LEGACY_STATUS_MAP[c.status] ?? c.status,
    dateRegistered: c.dateRegistered || c.dateFiled || new Date().toISOString(),
  }));
}

function importJanuaryActualClients(existingClients: Client[]) {
  const now = new Date().toISOString();
  const clients = [...existingClients];
  const indexByName = new Map<string, number>();

  clients.forEach((client, index) => {
    indexByName.set(normalizePrimaryClientName(client.companyName), index);
  });

  let created = 0;
  let enriched = 0;

  for (const seed of JANUARY_ACTUAL_CLIENTS) {
    const seedNames = [seed.companyName, ...(seed.aliases || [])];
    const existingIndex = seedNames
      .map(normalizePrimaryClientName)
      .map(name => indexByName.get(name))
      .find((index): index is number => index !== undefined);

    if (existingIndex !== undefined) {
      const existing = clients[existingIndex];
      const companyAddress = existing.companyAddress || seed.companyAddress;
      const sourceClient = existing.sourceClient || seed.sourceClient;

      if (companyAddress !== existing.companyAddress || sourceClient !== existing.sourceClient) {
        clients[existingIndex] = {
          ...existing,
          companyAddress,
          sourceClient,
          updatedAt: now,
        };
        enriched++;
      }

      for (const name of seedNames) {
        indexByName.set(normalizePrimaryClientName(name), existingIndex);
      }
      continue;
    }

    const newClient: Client = {
      id: uuidv4(),
      companyName: seed.companyName,
      lineOfBusiness: 'Others',
      companyAddress: seed.companyAddress,
      sourceClient: seed.sourceClient,
      companyClassMode: 'auto',
      createdAt: now,
      updatedAt: now,
      createdBy: 'January 2026 actual production import',
    };
    const newIndex = clients.push(newClient) - 1;
    for (const name of seedNames) {
      indexByName.set(normalizePrimaryClientName(name), newIndex);
    }
    created++;
  }

  return { clients, created, enriched };
}

interface DataContextType {
  clients: Client[];
  deals: Deal[];
  claims: Claim[];
  endorsements: Endorsement[];
  historyLogs: HistoryLog[];
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateClient: (id: string, client: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateDeal: (id: string, deal: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  updateDealStage: (id: string, newStage: DealStage, notes?: string) => void;
  recordApproval: (id: string, action: DealApprovalAction, notes?: string) => void;
  /** Move a deal to Policy On Progress and stamp bindDate. Returns false if the
   *  deal is missing an insurance company (required to bind). */
  bindDeal: (id: string, notes?: string) => boolean;

  /* ---- Insurers ---- */
  insurers: Insurer[];
  insurerMigrationReport: InsurerMigrationReport | null;
  addInsurer: (insurer: Omit<Insurer, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateInsurer: (id: string, updates: Partial<Insurer>) => void;
  /** Hard-deletes only when unreferenced; otherwise deactivates. Returns what it did. */
  removeInsurer: (id: string) => 'deleted' | 'deactivated';

  /* ---- Catalogues: products, benefits, lines of business ---- */
  products: CatalogueItem[];
  benefits: CatalogueItem[];
  linesOfBusiness: CatalogueItem[];
  catalogueSeedReports: CatalogueSeedReport[];
  addCatalogueItem: (kind: CatalogueKind, item: Omit<CatalogueItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCatalogueItem: (kind: CatalogueKind, id: string, updates: Partial<CatalogueItem>) => void;
  /** Hard-deletes only when unreferenced; otherwise deactivates. */
  removeCatalogueItem: (kind: CatalogueKind, id: string, referenced: boolean) => 'deleted' | 'deactivated';
  /* ---- Master policies & rating rules ---- */
  masterPolicies: MasterPolicy[];
  ratingRules: RatingRule[];
  addMasterPolicy: (mp: Omit<MasterPolicy, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateMasterPolicy: (id: string, updates: Partial<MasterPolicy>) => void;
  deleteMasterPolicy: (id: string) => void;
  addRatingRule: (rule: Omit<RatingRule, 'id' | 'createdAt'>) => void;
  updateRatingRule: (id: string, updates: Partial<RatingRule>) => void;
  deleteRatingRule: (id: string) => void;

  /* ---- Users & roles (UI shaping only — see utils/permissions.ts) ---- */
  users: AppUser[];
  /** Who the app is acting as. No auth — this is a switcher, not a session. */
  currentUserId: string | null;
  currentUser: AppUser | null;
  setCurrentUserId: (id: string) => void;
  addUser: (user: Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateUser: (id: string, updates: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;

  addClaim: (claim: Omit<Claim, 'id' | 'dateRegistered'>) => void;
  updateClaimStatus: (id: string, status: Claim['status']) => void;
  addEndorsement: (endorsement: Omit<Endorsement, 'id' | 'dateRequested'>) => void;
  updateEndorsementStatus: (id: string, status: Endorsement['status']) => void;
  clearDatabase: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [masterPolicies, setMasterPolicies] = useState<MasterPolicy[]>([]);
  const [ratingRules, setRatingRules] = useState<RatingRule[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(null);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [insurerMigrationReport, setInsurerMigrationReport] = useState<InsurerMigrationReport | null>(null);
  const [products, setProducts] = useState<CatalogueItem[]>([]);
  const [benefits, setBenefits] = useState<CatalogueItem[]>([]);
  const [linesOfBusiness, setLinesOfBusiness] = useState<CatalogueItem[]>([]);
  const [catalogueSeedReports, setCatalogueSeedReports] = useState<CatalogueSeedReport[]>([]);

  useEffect(() => {
    // Load data from localStorage on mount
    const load = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
    const storedClients: Client[] = load('clients');
    if (!localStorage.getItem(JANUARY_CLIENT_IMPORT_KEY)) {
      const migration = importJanuaryActualClients(storedClients);
      localStorage.setItem('clients', JSON.stringify(migration.clients));
      localStorage.setItem(JANUARY_CLIENT_IMPORT_KEY, JSON.stringify({
        importedAt: new Date().toISOString(),
        sourceCount: JANUARY_ACTUAL_CLIENTS.length,
        created: migration.created,
        enriched: migration.enriched,
      }));
      setClients(migration.clients);
    } else {
      setClients(storedClients);
    }
    // ---- Catalogues: seed once from the constants plus live client data ----
    const clientsForSeed: Client[] = JSON.parse(localStorage.getItem('clients') || '[]');
    if (!localStorage.getItem(CATALOGUE_SEED_KEY)) {
      const c = seedCatalogues(clientsForSeed);
      saveAll('products', c.products);
      saveAll('benefits', c.benefits);
      saveAll('linesOfBusiness', c.linesOfBusiness);
      localStorage.setItem(CATALOGUE_SEED_KEY, JSON.stringify(c.reports));
      setProducts(c.products);
      setBenefits(c.benefits);
      setLinesOfBusiness(c.linesOfBusiness);
      setCatalogueSeedReports(c.reports);
    } else {
      setProducts(load('products'));
      setBenefits(load('benefits'));
      setLinesOfBusiness(load('linesOfBusiness'));
      try { setCatalogueSeedReports(JSON.parse(localStorage.getItem(CATALOGUE_SEED_KEY)!)); }
      catch { setCatalogueSeedReports([]); }
    }

    setClaims(migrateClaims(load('claims')));
    setEndorsements(load('endorsements'));
    setHistoryLogs(load('historyLogs'));
    setRatingRules(load('ratingRules'));

    // ---- Insurer catalogue: seed once, then backfill insurerId ----
    const storedDeals: Deal[] = load('deals');
    const storedMPs: MasterPolicy[] = load('masterPolicies');
    const storedInsurers: Insurer[] = load('insurers');

    if (!localStorage.getItem(INSURER_MIGRATION_KEY)) {
      const m = seedInsurersAndBackfill(storedDeals, storedMPs);
      saveAll('insurers', m.insurers);
      saveAll('deals', m.deals);
      saveAll('masterPolicies', m.masterPolicies);
      localStorage.setItem(INSURER_MIGRATION_KEY, JSON.stringify(m.report));
      setInsurers(m.insurers);
      setDeals(m.deals);
      setMasterPolicies(m.masterPolicies);
      setInsurerMigrationReport(m.report);
    } else {
      setInsurers(storedInsurers);
      setDeals(storedDeals);
      setMasterPolicies(storedMPs);
      try {
        setInsurerMigrationReport(JSON.parse(localStorage.getItem(INSURER_MIGRATION_KEY)!));
      } catch { setInsurerMigrationReport(null); }
    }

    // Seed a single Administrator on first run. Without one there would be no
    // way to reach Users & Roles and create the first account.
    const storedUsers: AppUser[] = load('users');
    const seeded = storedUsers.length > 0 ? storedUsers : [{
      id: uuidv4(),
      name: 'Admin User',
      email: 'admin@bindcover.com',
      role: 'Administrator' as UserRole,
      division: 'Management',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
    if (storedUsers.length === 0) saveAll('users', seeded);
    setUsers(seeded);

    const storedCurrent = localStorage.getItem('currentUserId');
    const valid = storedCurrent && seeded.some(u => u.id === storedCurrent && u.active);
    setCurrentUserIdState(valid ? storedCurrent : (seeded.find(u => u.active)?.id ?? null));
  }, []);

  const saveAll = (dataKey: string, data: any) => {
    localStorage.setItem(dataKey, JSON.stringify(data));
  };

  const addClient = (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newClient: Client = {
      ...clientData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setClients(prev => {
      const newClients = [...prev, newClient];
      saveAll('clients', newClients);
      return newClients;
    });
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients(prev => {
      const newClients = prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c);
      saveAll('clients', newClients);
      return newClients;
    });
  };

  const deleteClient = (id: string) => {
    setClients(prev => {
      const newClients = prev.filter(c => c.id !== id);
      saveAll('clients', newClients);
      return newClients;
    });
  };

  const addDeal = (dealData: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newDeal: Deal = {
      ...dealData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDeals(prev => {
      const newDeals = [...prev, newDeal];
      saveAll('deals', newDeals);
      return newDeals;
    });
  };

  const updateDeal = (id: string, updates: Partial<Deal>) => {
    setDeals(prev => {
      const newDeals = prev.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d);
      saveAll('deals', newDeals);
      return newDeals;
    });
  };

  const deleteDeal = (id: string) => {
    setDeals(prev => {
      const newDeals = prev.filter(d => d.id !== id);
      saveAll('deals', newDeals);
      return newDeals;
    });
  };

  const updateDealStage = (id: string, newStage: DealStage, notes?: string) => {
    const deal = deals.find(d => d.id === id);
    if (!deal || deal.statusStage === newStage) return;

    const oldStage = deal.statusStage;
    const nowIso = new Date().toISOString();

    // Append to the per-deal stage log so the journey page can render history.
    const stageLogEntry: DealStageLogEntry = {
      fromStage: oldStage,
      toStage: newStage,
      notes: notes?.trim() || undefined,
      at: nowIso,
    };

    const updatedDeal: Deal = {
      ...deal,
      statusStage: newStage,
      stageLog: [...(deal.stageLog || []), stageLogEntry],
      updatedAt: nowIso,
    };

    // Automatically move to Renewal Client if a New Business reaches Policy On Progress
    if (deal.dealType === 'New Business' && newStage === 'Policy On Progress') {
      updatedDeal.dealType = 'Renewal';
    }

    const newDeals = deals.map(d => d.id === id ? updatedDeal : d);

    // Add history log (kept for backwards compatibility with anything that reads it)
    const newLog: HistoryLog = {
      id: uuidv4(),
      dealId: id,
      fromStage: oldStage,
      toStage: newStage,
      date: nowIso,
    };
    const newLogs = [...historyLogs, newLog];

    setDeals(newDeals);
    setHistoryLogs(newLogs);
    saveAll('deals', newDeals);
    saveAll('historyLogs', newLogs);
  };

  const bindDeal = (id: string, notes?: string): boolean => {
    const deal = deals.find(d => d.id === id);
    if (!deal) return false;
    if (!deal.insuranceCompany) return false;

    const nowIso = new Date().toISOString();
    const wasAlreadyOnProgress = deal.statusStage === 'Policy On Progress';

    // Append stage transition log only if the stage actually changes.
    const updatedDeal: Deal = {
      ...deal,
      statusStage: 'Policy On Progress',
      bindDate: deal.bindDate || nowIso,
      stageLog: wasAlreadyOnProgress
        ? deal.stageLog
        : [
            ...(deal.stageLog || []),
            {
              fromStage: deal.statusStage,
              toStage: 'Policy On Progress',
              notes: (notes?.trim()) || 'Bound from pipeline.',
              at: nowIso,
            },
          ],
      // Auto-flip dealType for new business so it shows up in the renewal track next cycle.
      dealType: deal.dealType === 'New Business' ? 'Renewal' : deal.dealType,
      updatedAt: nowIso,
    };

    setDeals(prev => {
      const newDeals = prev.map(d => d.id === id ? updatedDeal : d);
      saveAll('deals', newDeals);
      return newDeals;
    });

    if (!wasAlreadyOnProgress) {
      const newLog: HistoryLog = {
        id: uuidv4(),
        dealId: id,
        fromStage: deal.statusStage,
        toStage: 'Policy On Progress',
        date: nowIso,
      };
      setHistoryLogs(prev => {
        const newLogs = [...prev, newLog];
        saveAll('historyLogs', newLogs);
        return newLogs;
      });
    }

    return true;
  };

  const recordApproval = (id: string, action: DealApprovalAction, notes?: string) => {
    const deal = deals.find(d => d.id === id);
    if (!deal) return;

    const nextStatus: DealApprovalStatus =
      action === 'Approve' ? 'Approved'
        : action === 'Reject' ? 'Rejected'
          : 'Needs Adjustment';

    const entry: DealApprovalLogEntry = {
      action,
      notes: notes?.trim() || undefined,
      at: new Date().toISOString(),
    };

    setDeals(prev => {
      const newDeals = prev.map(d => d.id === id ? {
        ...d,
        approvalStatus: nextStatus,
        approvalLog: [...(d.approvalLog || []), entry],
        updatedAt: new Date().toISOString(),
      } : d);
      saveAll('deals', newDeals);
      return newDeals;
    });
  };

  /* ---- Master policies -------------------------------------------------- */

  /** Returns the new id so the caller can navigate straight to the cover. */
  const addMasterPolicy = (data: Omit<MasterPolicy, 'id' | 'createdAt' | 'updatedAt'>): string => {
    const now = new Date().toISOString();
    const created: MasterPolicy = { ...data, id: uuidv4(), createdAt: now, updatedAt: now };
    setMasterPolicies(prev => {
      const next = [...prev, created];
      saveAll('masterPolicies', next);
      return next;
    });
    return created.id;
  };

  const updateMasterPolicy = (id: string, updates: Partial<MasterPolicy>) => {
    setMasterPolicies(prev => {
      const next = prev.map(mp =>
        mp.id === id ? { ...mp, ...updates, updatedAt: new Date().toISOString() } : mp);
      saveAll('masterPolicies', next);
      return next;
    });
  };

  const deleteMasterPolicy = (id: string) => {
    setMasterPolicies(prev => {
      const next = prev.filter(mp => mp.id !== id);
      saveAll('masterPolicies', next);
      return next;
    });
    // A rule has no meaning without its cover.
    setRatingRules(prev => {
      const next = prev.filter(r => r.masterPolicyId !== id);
      saveAll('ratingRules', next);
      return next;
    });
  };

  /* ---- Rating rules ----------------------------------------------------- */

  const addRatingRule = (data: Omit<RatingRule, 'id' | 'createdAt'>) => {
    const created: RatingRule = { ...data, id: uuidv4(), createdAt: new Date().toISOString() };
    setRatingRules(prev => {
      const next = [...prev, created];
      saveAll('ratingRules', next);
      return next;
    });
  };

  const updateRatingRule = (id: string, updates: Partial<RatingRule>) => {
    setRatingRules(prev => {
      const next = prev.map(r => r.id === id ? { ...r, ...updates } : r);
      saveAll('ratingRules', next);
      return next;
    });
  };

  const deleteRatingRule = (id: string) => {
    setRatingRules(prev => {
      const next = prev.filter(r => r.id !== id);
      saveAll('ratingRules', next);
      return next;
    });
  };

  /* ---- Users -------------------------------------------------------------
   * Role-based UI shaping only. There is no auth, so none of this protects
   * data — see utils/permissions.ts. The last-Administrator rule is enforced
   * in the UI via canSaveUserEdit / canDeleteUser.
   * TODO(supabase): mirror every guard server-side when auth lands.
   */

  const setCurrentUserId = (id: string) => {
    localStorage.setItem('currentUserId', id);
    setCurrentUserIdState(id);
  };

  const addUser = (data: Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const created: AppUser = { ...data, id: uuidv4(), createdAt: now, updatedAt: now };
    setUsers(prev => {
      const next = [...prev, created];
      saveAll('users', next);
      return next;
    });
  };

  const updateUser = (id: string, updates: Partial<AppUser>) => {
    setUsers(prev => {
      const next = prev.map(u =>
        u.id === id ? { ...u, ...updates, updatedAt: new Date().toISOString() } : u);
      saveAll('users', next);
      return next;
    });
  };

  const deleteUser = (id: string) => {
    setUsers(prev => {
      const next = prev.filter(u => u.id !== id);
      saveAll('users', next);
      // Never leave the app acting as a user that no longer exists.
      if (currentUserId === id) {
        const fallback = next.find(u => u.active)?.id ?? null;
        if (fallback) localStorage.setItem('currentUserId', fallback);
        else localStorage.removeItem('currentUserId');
        setCurrentUserIdState(fallback);
      }
      return next;
    });
  };

  /* ---- Insurers ---------------------------------------------------------- */

  const addInsurer = (data: Omit<Insurer, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    setInsurers(prev => {
      const next = [...prev, { ...data, id: uuidv4(), createdAt: now, updatedAt: now }];
      saveAll('insurers', next);
      return next;
    });
  };

  const updateInsurer = (id: string, updates: Partial<Insurer>) => {
    setInsurers(prev => {
      const next = prev.map(i =>
        i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i);
      saveAll('insurers', next);
      return next;
    });
  };

  /**
   * Soft delete. An insurer referenced by any deal or master policy is
   * deactivated rather than removed, so the history on those records keeps
   * resolving. Only a completely unreferenced insurer is actually deleted.
   */
  const removeInsurer = (id: string): 'deleted' | 'deactivated' => {
    const referenced =
      deals.some(d => d.insurerId === id) ||
      masterPolicies.some(mp => mp.insurerId === id);

    if (referenced) {
      updateInsurer(id, { active: false });
      return 'deactivated';
    }
    setInsurers(prev => {
      const next = prev.filter(i => i.id !== id);
      saveAll('insurers', next);
      return next;
    });
    return 'deleted';
  };

  /* ---- Catalogues -------------------------------------------------------- */

  const CATALOGUE_SETTERS: Record<CatalogueKind, React.Dispatch<React.SetStateAction<CatalogueItem[]>>> = {
    products: setProducts,
    benefits: setBenefits,
    linesOfBusiness: setLinesOfBusiness,
  };

  const addCatalogueItem = (
    kind: CatalogueKind,
    data: Omit<CatalogueItem, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    const now = new Date().toISOString();
    CATALOGUE_SETTERS[kind](prev => {
      const next = [...prev, { ...data, id: uuidv4(), createdAt: now, updatedAt: now }];
      saveAll(kind, next);
      return next;
    });
  };

  const updateCatalogueItem = (kind: CatalogueKind, id: string, updates: Partial<CatalogueItem>) => {
    CATALOGUE_SETTERS[kind](prev => {
      const next = prev.map(i =>
        i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i);
      saveAll(kind, next);
      return next;
    });
  };

  /**
   * Soft delete. The caller supplies whether the item is referenced, since each
   * catalogue is referenced through a different field — products via
   * Deal.productType, lines of business via Client.lineOfBusiness, benefits by
   * nothing yet.
   */
  const removeCatalogueItem = (
    kind: CatalogueKind,
    id: string,
    referenced: boolean,
  ): 'deleted' | 'deactivated' => {
    if (referenced) {
      updateCatalogueItem(kind, id, { active: false });
      return 'deactivated';
    }
    CATALOGUE_SETTERS[kind](prev => {
      const next = prev.filter(i => i.id !== id);
      saveAll(kind, next);
      return next;
    });
    return 'deleted';
  };

  const addClaim = (claimData: Omit<Claim, 'id' | 'dateRegistered'>) => {
    const newClaim: Claim = {
      ...claimData,
      id: uuidv4(),
      dateRegistered: new Date().toISOString(),
    };
    const newClaims = [...claims, newClaim];
    setClaims(newClaims);
    saveAll('claims', newClaims);
  };

  const updateClaimStatus = (id: string, status: Claim['status']) => {
    const newClaims = claims.map(c => c.id === id ? { ...c, status } : c);
    setClaims(newClaims);
    saveAll('claims', newClaims);
  };

  const addEndorsement = (endorsementData: Omit<Endorsement, 'id' | 'dateRequested'>) => {
    const newEndorsement: Endorsement = {
      ...endorsementData,
      id: uuidv4(),
      dateRequested: new Date().toISOString(),
    };
    const newEndorsements = [...endorsements, newEndorsement];
    setEndorsements(newEndorsements);
    saveAll('endorsements', newEndorsements);
  };

  const updateEndorsementStatus = (id: string, status: Endorsement['status']) => {
    const newEndorsements = endorsements.map(e => e.id === id ? { ...e, status } : e);
    setEndorsements(newEndorsements);
    saveAll('endorsements', newEndorsements);
  };

  const clearDatabase = () => {
    localStorage.clear();
    localStorage.setItem(JANUARY_CLIENT_IMPORT_KEY, JSON.stringify({ clearedAt: new Date().toISOString() }));
    setClients([]);
    setDeals([]);
    setClaims([]);
    setEndorsements([]);
    setHistoryLogs([]);
    setMasterPolicies([]);
    setRatingRules([]);
    setUsers([]);
    setCurrentUserIdState(null);
    setInsurers([]);
    setInsurerMigrationReport(null);
    setProducts([]);
    setBenefits([]);
    setLinesOfBusiness([]);
    setCatalogueSeedReports([]);
  };

  return (
    <DataContext.Provider value={{
      clients, deals, claims, endorsements, historyLogs,
      addClient, updateClient, deleteClient,
      addDeal, updateDeal, deleteDeal, updateDealStage, recordApproval, bindDeal,
      users,
      currentUserId,
      currentUser: users.find(u => u.id === currentUserId) ?? null,
      setCurrentUserId, addUser, updateUser, deleteUser,
      insurers, insurerMigrationReport, addInsurer, updateInsurer, removeInsurer,
      products, benefits, linesOfBusiness, catalogueSeedReports,
      addCatalogueItem, updateCatalogueItem, removeCatalogueItem,
      masterPolicies, ratingRules,
      addMasterPolicy, updateMasterPolicy, deleteMasterPolicy,
      addRatingRule, updateRatingRule, deleteRatingRule,
      addClaim, updateClaimStatus, addEndorsement, updateEndorsementStatus,
      clearDatabase
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
