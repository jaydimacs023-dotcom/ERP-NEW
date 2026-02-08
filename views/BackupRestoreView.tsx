import React, { useState, useRef, useEffect } from 'react';
import {
  Download, Upload, AlertCircle, CheckCircle2, Clock, Database,
  Shield, FileJson, Trash2, RotateCw, Info, ChevronDown, ChevronUp,
  ZoomIn, Calendar, User, HardDrive
} from 'lucide-react';
import { Organization, AuditLog } from '../types';
import { BackupRestoreService, BackupData, BackupMetadata } from '../services/BackupRestoreService';

interface BackupRestoreViewProps {
  organizations: Organization[];
  currentOrgId: string;
  currentUserId: string;
  currentUserName: string;
  allData: any;
  onRestore: (data: any) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  currency?: string;
}

interface BackupFile {
  id: string;
  filename: string;
  size: number;
  uploadedAt: string;
  metadata?: BackupMetadata;
}

const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({
  organizations,
  currentOrgId,
  currentUserId,
  currentUserName,
  allData,
  onRestore,
  onNotify,
  currency = 'USD'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(currentOrgId);
  const [backupDescription, setBackupDescription] = useState<string>('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupData | null>(null);
  const [expandedBackupId, setExpandedBackupId] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const selectedOrg = organizations.find(o => o.id === selectedOrgId && !o.isDeleted);

  // Load backups from localStorage
  useEffect(() => {
    const loadedBackups = localStorage.getItem(`backups_${selectedOrgId}`);
    if (loadedBackups) {
      try {
        setBackups(JSON.parse(loadedBackups));
      } catch (e) {
        console.error('Failed to load backups:', e);
      }
    }
  }, [selectedOrgId]);

  const handleCreateBackup = async () => {
    if (!selectedOrg) {
      onNotify('error', 'No organization selected');
      return;
    }

    setIsCreatingBackup(true);
    try {
      const backup = BackupRestoreService.createBackup(
        selectedOrgId,
        selectedOrg.name,
        allData,
        currentUserId,
        backupDescription
      );

      // Download the backup file
      BackupRestoreService.downloadBackup(backup);

      // Store backup metadata locally
      const newBackupFile: BackupFile = {
        id: `backup_${Date.now()}`,
        filename: `Backup_${selectedOrg.name.replace(/[^a-zA-Z0-9-]/g, '_')}_${backup.metadata.backupDate}.json`,
        size: JSON.stringify(backup).length,
        uploadedAt: new Date().toISOString(),
        metadata: backup.metadata,
      };

      const updatedBackups = [newBackupFile, ...backups].slice(0, 20); // Keep last 20
      setBackups(updatedBackups);
      localStorage.setItem(`backups_${selectedOrgId}`, JSON.stringify(updatedBackups));

      setBackupDescription('');
      onNotify('success', `Backup created and downloaded: ${newBackupFile.filename}`);
    } catch (error: any) {
      onNotify('error', `Failed to create backup: ${error.message}`);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string) as BackupData;

        // Validate backup
        const validation = BackupRestoreService.validateBackupFile(backup);
        if (!validation.valid) {
          onNotify('error', `Invalid backup file:\n${validation.errors.join('\n')}`);
          return;
        }

        // Validate organization match
        if (backup.metadata.organizationId !== selectedOrgId) {
          onNotify(
            'warning',
            `This backup is for organization "${backup.metadata.organizationName}", but you're about to restore to "${selectedOrg?.name}". Make sure this is intentional.`
          );
        }

        setSelectedBackup(backup);
        setShowRestoreConfirm(true);
      } catch (err) {
        onNotify('error', 'Invalid backup file format. Please select a valid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup || !selectedOrg) {
      onNotify('error', 'No backup selected for restoration');
      return;
    }

    setIsRestoringBackup(true);
    try {
      // Perform restoration
      await onRestore(selectedBackup);

      // Update local backup list
      const restoredBackupFile: BackupFile = {
        id: `backup_restored_${Date.now()}`,
        filename: selectedBackup.metadata.organizationName,
        size: JSON.stringify(selectedBackup).length,
        uploadedAt: new Date().toISOString(),
        metadata: selectedBackup.metadata,
      };

      const updatedBackups = [restoredBackupFile, ...backups];
      setBackups(updatedBackups);
      localStorage.setItem(`backups_${selectedOrgId}`, JSON.stringify(updatedBackups));

      setSelectedBackup(null);
      setShowRestoreConfirm(false);
      onNotify('success', `Backup restored successfully for ${selectedOrg.name}`);
    } catch (error: any) {
      onNotify('error', `Failed to restore backup: ${error.message}`);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleDeleteBackup = (id: string) => {
    if (confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
      const updatedBackups = backups.filter(b => b.id !== id);
      setBackups(updatedBackups);
      localStorage.setItem(`backups_${selectedOrgId}`, JSON.stringify(updatedBackups));
      onNotify('info', 'Backup deleted');
    }
  };

  const getBackupSummary = (backup: BackupData) => {
    return BackupRestoreService.getBackupSummary(backup);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Data Backup & Restore</h2>
          <p className="text-sm text-slate-500 font-normal italic mt-2">
            Comprehensive per-organization backup and disaster recovery
          </p>
        </div>

        {/* Organization Selector */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Select Organization
          </label>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {organizations
              .filter(o => !o.isDeleted)
              .map(org => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.code})
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-r-lg">
        <div className="flex gap-3">
          <Info size={20} className="text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-indigo-900">Backup & Restore</p>
            <p className="text-indigo-700 text-xs mt-1">
              Create snapshots of your organization's data (students, accounts, transactions, etc.) and restore from previous backups.
              Backups are stored locally and encrypted.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Create Backup Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Download size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight">Create Backup</h3>
              <p className="text-xs text-slate-500 mt-1">Export current organization data</p>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Backup Description (Optional)
              </label>
              <textarea
                value={backupDescription}
                onChange={(e) => setBackupDescription(e.target.value)}
                placeholder="e.g., Full year-end backup, Before major changes, etc."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {selectedOrg && (
              <div className="bg-slate-50 p-3 rounded-lg space-y-1">
                <p className="text-xs font-semibold text-slate-700">
                  <span className="text-slate-500">Organization:</span> {selectedOrg.name}
                </p>
                <p className="text-xs font-semibold text-slate-700">
                  <span className="text-slate-500">Created By:</span> {currentUserName}
                </p>
                <p className="text-xs text-slate-600">
                  Will include all students, employees, accounts, transactions, inventory, and configuration data.
                </p>
              </div>
            )}

            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup || !selectedOrg}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isCreatingBackup ? (
                <>
                  <RotateCw size={16} className="animate-spin" />
                  Creating backup...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Create & Download Backup
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 text-center">
              Backup will be saved to your downloads folder
            </p>
          </div>
        </div>

        {/* Restore Backup Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Upload size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight">Restore Backup</h3>
              <p className="text-xs text-slate-500 mt-1">Import from previous backup file</p>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <p className="text-xs font-bold text-red-700">⚠️ Warning</p>
              <p className="text-xs text-red-600 mt-1">
                Restoring a backup will replace all current data for this organization. This action cannot be undone without another backup.
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".json"
              onChange={handleSelectFile}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRestoringBackup}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              Select Backup File
            </button>

            {selectedBackup && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <p className="text-xs font-semibold text-slate-700">Selected: {selectedBackup.metadata.organizationName}</p>
                <p className="text-xs text-slate-600">Date: {selectedBackup.metadata.backupDate}</p>
                <button
                  onClick={() => setSelectedBackup(null)}
                  className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
                >
                  ✕ Clear Selection
                </button>
              </div>
            )}

            <button
              onClick={() => setShowRestoreConfirm(true)}
              disabled={!selectedBackup || isRestoringBackup}
              className="w-full py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isRestoringBackup ? (
                <>
                  <RotateCw size={14} className="animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Restore Backup
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      {showRestoreConfirm && selectedBackup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle size={24} />
              <h3 className="font-black text-lg uppercase">Confirm Restore</h3>
            </div>

            <p className="text-sm text-slate-700">
              This will restore all data from the backup dated <strong>{selectedBackup.metadata.backupDate}</strong> for organization <strong>{selectedBackup.metadata.organizationName}</strong>.
            </p>

            <p className="text-sm text-slate-700">
              All current data will be permanently replaced. Make sure you have a backup of your current data first.
            </p>

            <div className="bg-slate-50 p-3 rounded-lg space-y-1">
              <p className="text-xs font-semibold text-slate-700">Backup Summary:</p>
              <p className="text-xs text-slate-600">
                {selectedBackup.metadata.recordCount && Object.values(selectedBackup.metadata.recordCount).reduce((a, b) => a + b, 0)} total records
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowRestoreConfirm(false)}
                disabled={isRestoringBackup}
                className="flex-1 py-2 border border-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={isRestoringBackup}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRestoringBackup ? (
                  <>
                    <RotateCw size={14} className="animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Restore Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup History */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-slate-100 rounded-lg">
            <HardDrive size={20} className="text-slate-600" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 uppercase tracking-tight">Backup History</h3>
            <p className="text-xs text-slate-500 mt-1">{backups.length} backup(s) stored</p>
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="py-8 text-center">
            <Database size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No backups created yet</p>
            <p className="text-slate-400 text-xs mt-1">Create your first backup to see it here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div key={backup.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedBackupId(expandedBackupId === backup.id ? null : backup.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <FileJson size={18} className="text-slate-400" />
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{backup.filename}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(backup.uploadedAt)} • {formatFileSize(backup.size)}
                      </p>
                    </div>
                  </div>
                  {expandedBackupId === backup.id ? (
                    <ChevronUp size={18} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400" />
                  )}
                </button>

                {expandedBackupId === backup.id && backup.metadata && (
                  <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-600">Organization</p>
                        <p className="text-sm text-slate-900">{backup.metadata.organizationName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600">Created By</p>
                        <p className="text-sm text-slate-900">{backup.metadata.createdBy}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600">Date & Time</p>
                        <p className="text-sm text-slate-900">
                          {backup.metadata.backupDate} {backup.metadata.backupTime}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600">Total Records</p>
                        <p className="text-sm text-slate-900 font-mono">
                          {Object.values(backup.metadata.recordCount).reduce((a: number, b: number) => a + b, 0)}
                        </p>
                      </div>
                    </div>

                    {backup.metadata.description && (
                      <div>
                        <p className="text-xs font-semibold text-slate-600">Description</p>
                        <p className="text-sm text-slate-700">{backup.metadata.description}</p>
                      </div>
                    )}

                    <div className="bg-white rounded p-3 space-y-1 text-xs">
                      <p className="font-semibold text-slate-700 mb-2">Record Summary:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(backup.metadata.recordCount)
                          .filter(([, count]) => count > 0)
                          .map(([type, count]) => (
                            <div key={type} className="text-slate-600">
                              <span className="capitalize">{type.replace(/([A-Z])/g, ' $1').trim()}:</span>
                              <span className="font-mono font-bold text-slate-900 ml-1">{count}</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3">
                      <button
                        onClick={() => {
                          setSelectedBackup(
                            BackupRestoreService.createBackup(
                              backup.metadata!.organizationId,
                              backup.metadata!.organizationName,
                              allData,
                              currentUserId
                            )
                          );
                          setShowRestoreConfirm(true);
                        }}
                        className="flex-1 py-2 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-xs hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <Upload size={12} />
                        Restore
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(backup.id)}
                        className="flex-1 py-2 bg-red-50 text-red-700 rounded-lg font-bold text-xs hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Best Practices */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-black text-slate-900 uppercase tracking-tight mb-3 flex items-center gap-2">
          <Shield size={18} className="text-blue-600" />
          Best Practices
        </h4>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>✓ Create backups before making major changes (data migrations, period closings, etc.)</li>
          <li>✓ Schedule regular backups (daily/weekly) for disaster recovery</li>
          <li>✓ Store backups in multiple locations (cloud storage, external drives)</li>
          <li>✓ Test restore procedures periodically to ensure data integrity</li>
          <li>✓ Use descriptive backup names to easily identify important snapshots</li>
          <li>✓ Keep at least 3 recent backups at all times</li>
        </ul>
      </div>
    </div>
  );
};

export default BackupRestoreView;
