
import { IDataService } from './IDataService';
import { SupabaseDataService } from './SupabaseDataService';

export class DataServiceFactory {
  private static instance: IDataService;

  /**
   * SUPABASE-ONLY FACTORY
   * Always returns SupabaseDataService for production consistency
   */
  static getService(): IDataService {
    if (!this.instance) {
      this.instance = new SupabaseDataService();
    }
    return this.instance;
  }
}
