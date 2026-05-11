import React, { createContext, useContext, useState, useEffect } from 'react';
import { Deal, Claim, ClaimStatus, Endorsement, HistoryLog, DealStage, DealType, Client } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
  updateDealStage: (id: string, newStage: DealStage) => void;
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

  useEffect(() => {
    // Load data from localStorage on mount
    const load = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
    setClients(load('clients'));
    setDeals(load('deals'));
    setClaims(migrateClaims(load('claims')));
    setEndorsements(load('endorsements'));
    setHistoryLogs(load('historyLogs'));
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

  const updateDealStage = (id: string, newStage: DealStage) => {
    const deal = deals.find(d => d.id === id);
    if (!deal || deal.statusStage === newStage) return;

    const oldStage = deal.statusStage;
    const updatedDeal: Deal = { ...deal, statusStage: newStage, updatedAt: new Date().toISOString() };

    // Automatically move to Renewal Client if a New Business reaches Policy On Progress
    if (deal.dealType === 'New Business' && newStage === 'Policy On Progress') {
      updatedDeal.dealType = 'Renewal';
    }

    const newDeals = deals.map(d => d.id === id ? updatedDeal : d);

    // Add history log
    const newLog: HistoryLog = {
      id: uuidv4(),
      dealId: id,
      fromStage: oldStage,
      toStage: newStage,
      date: new Date().toISOString()
    };
    const newLogs = [...historyLogs, newLog];

    setDeals(newDeals);
    setHistoryLogs(newLogs);
    saveAll('deals', newDeals);
    saveAll('historyLogs', newLogs);
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
    setClients([]);
    setDeals([]);
    setClaims([]);
    setEndorsements([]);
    setHistoryLogs([]);
  };

  return (
    <DataContext.Provider value={{
      clients, deals, claims, endorsements, historyLogs,
      addClient, updateClient, deleteClient,
      addDeal, updateDeal, deleteDeal, updateDealStage,
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