export interface SirkSession {
  runName: string;
  instanceNumber: number;
  totalInstances: number;
  project: string;
}

export class SpindlesClient {
  private baseUrl: string;
  
  constructor(spindlesProxyUrl: string = 'http://localhost:8082') {
    this.baseUrl = spindlesProxyUrl;
  }
  
  async setSession(session: SirkSession): Promise<void> {
    console.error(`[forge] Setting spindles session: instance ${session.instanceNumber}/${session.totalInstances}`);
    
    const response = await fetch(`${this.baseUrl}/sirk/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to set spindles session: ${response.status} ${text}`);
    }
  }
  
  async clearSession(): Promise<void> {
    console.error('[forge] Clearing spindles session');
    
    const response = await fetch(`${this.baseUrl}/sirk/session`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to clear spindles session: ${response.status} ${text}`);
    }
  }
  
  async getSession(): Promise<SirkSession | null> {
    const response = await fetch(`${this.baseUrl}/sirk/session`);
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get spindles session: ${response.status} ${text}`);
    }
    
    return response.json() as Promise<SirkSession>;
  }
}
