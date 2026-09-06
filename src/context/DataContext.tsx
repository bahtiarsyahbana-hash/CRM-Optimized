import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Deal, Claim, ClaimStatus, Endorsement, HistoryLog, DealStage, DealType, Client,
  DealApprovalAction, DealApprovalLogEntry, DealApprovalStatus, DealStageLogEntry,
  MasterPolicy, RatingRule,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  JANUARY_ACTUAL_CLIENTS,
  normalizePrimaryClientName,
} from '../data/januaryActualClients';

const JANUARY_CLIENT_IMPORT_KEY = 'iris_january_2026_actual_clients_v1';

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
  /* ---- Master policies & rating rules ---- */
  masterPolicies: MasterPolicy[];
  ratingRules: RatingRule[];
  addMasterPolicy: (mp: Omit<MasterPolicy, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateMasterPolicy: (id: string, updates: Partial<MasterPolicy>) => void;
  deleteMasterPolicy: (id: string) => void;
  addRatingRule: (rule: Omit<RatingRule, 'id' | 'createdAt'>) => void;
  updateRatingRule: (id: string, updates: Partial<RatingRule>) => void;
  deleteRatingRule: (id: string) => void;

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
    setDeals(load('deals'));
    setClaims(migrateClaims(load('claims')));
    setEndorsements(load('endorsements'));
    setHistoryLogs(load('historyLogs'));
    setMasterPolicies(load('masterPolicies'));
    setRatingRules(load('ratingRules'));
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
  };

  return (
    <DataContext.Provider value={{
      clients, deals, claims, endorsements, historyLogs,
      addClient, updateClient, deleteClient,
      addDeal, updateDeal, deleteDeal, updateDealStage, recordApproval, bindDeal,
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
