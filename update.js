const fs = require('fs');

// 1. Update JournalForm
let jf = fs.readFileSync('components/JournalForm.tsx', 'utf8');

jf = jf.replace(
  /interface JournalFormProps \{[\s\S]*?onClose: \(\) => void;\n\}/m,
  `interface JournalFormProps {
  accounts: ChartOfAccount[];
  students: Student[];
  trainers: Trainer[];
  sponsors: Sponsor[];
  batches: Batch[];
  items: NonStockItem[];
  qualifications: Qualification[];
  entries: JournalEntry[];
  initialEntry?: Partial<JournalEntry>;
  initialLines?: Partial<JournalLine>[];
  onSubmit: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onClose: () => void;
}`
);

jf = jf.replace(
  /const JournalForm: React\.FC<JournalFormProps> = \(\{[\s\S]*?\}\) => \{/m,
  `const JournalForm: React.FC<JournalFormProps> = ({
  accounts, students, trainers, sponsors, batches, items = [], qualifications, entries, initialEntry, initialLines, onSubmit, onClose
}) => {`
);

jf = jf.replace(
  /const \[entry, setEntry\] = useState<Partial<JournalEntry>>\(buildEmptyEntry\(\)\);\n\n  useEffect\(\(\) => \{\n    const nextRef = AccountingService\.getNextReference\(entries, 'JV'\);\n    setEntry\(prev => \(\{ \.\.\.prev, reference: nextRef \}\)\);\n  \}, \[entries\]\);\n\n  const buildDefaultLines = \(\): Partial<JournalLine>\[\] => \(\[\]\);\n\n  const \[lines, setLines\] = useState<Partial<JournalLine>\[\]>\(buildDefaultLines\(\)\);/m,
  `const [entry, setEntry] = useState<Partial<JournalEntry>>(initialEntry || buildEmptyEntry());

  useEffect(() => {
    if (!initialEntry) {
      const nextRef = AccountingService.getNextReference(entries, 'JV');
      setEntry(prev => ({ ...prev, reference: nextRef }));
    }
  }, [entries, initialEntry]);

  const buildDefaultLines = (): Partial<JournalLine>[] => ([]);

  const [lines, setLines] = useState<Partial<JournalLine>[]>(initialLines || buildDefaultLines());`
);

jf = jf.replace(
  /const entryId = `je-\$\{Date\.now\(\)\}`;([\s\S]*?)id: `l-\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`,/m,
  `const entryId = entry.id || \`je-\${Date.now()}\`;$1id: l.id || \`l-\${Math.random().toString(36).substr(2, 9)}\`,`
);

jf = jf.replace(
  /onSubmit\(\{ \.\.\.entry, id: entryId, status, createdAt: new Date\(\)\.toISOString\(\) \}, finalizedLines\);/m,
  `onSubmit({ ...entry, id: entryId, status, createdAt: entry.createdAt || new Date().toISOString() }, finalizedLines);`
);

fs.writeFileSync('components/JournalForm.tsx', jf);

// 2. Update Ledger
let ld = fs.readFileSync('views/Ledger.tsx', 'utf8');

ld = ld.replace(
  /const \[showEntryForm, setShowEntryForm\] = useState\(false\);\n  const \[selectedEntry, setSelectedEntry\] = useState<JournalEntry \| null>\(null\);/,
  `const [showEntryForm, setShowEntryForm] = useState(false);\n  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);\n  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);`
);

ld = ld.replace(
  /onClick=\{\(\) => setShowEntryForm\(true\)\}/,
  `onClick={() => {\n              setEditingEntry(null);\n              setShowEntryForm(true);\n            }}`
);

ld = ld.replace(
  /onClick=\{\(\) => setSelectedEntry\(entry\)\}/g,
  `onClick={() => {\n                      setEditingEntry(entry);\n                      setShowEntryForm(true);\n                    }}`
);

ld = ld.replace(
  /\{showEntryForm && \([\s\S]*?<JournalForm[\s\S]*?entries=\{entries\}\n[\s\S]*?onClose=\{\(\) => setShowEntryForm\(false\)\}\n\s*onSubmit=\{\(entry, lines\) => \{\n\s*onPostEntry\?\.\(entry, lines\);\n\s*setShowEntryForm\(false\);\n\s*\}\}\n\s*\/>\n\s*\)\}/,
  `{showEntryForm && (
        <JournalForm
          accounts={accounts}
          students={students}
          trainers={trainers}
          sponsors={sponsors}
          batches={batches}
          items={items}
          qualifications={qualifications}
          entries={entries}
          initialEntry={editingEntry || undefined}
          initialLines={editingEntry ? lines.filter(l => l.journalEntryId === editingEntry.id) : undefined}
          onClose={() => {
            setShowEntryForm(false);
            setEditingEntry(null);
          }}
          onSubmit={(entry, formLines) => {
            onPostEntry?.(entry, formLines);
            setShowEntryForm(false);
            setEditingEntry(null);
          }}
        />
      )}`
);

fs.writeFileSync('views/Ledger.tsx', ld);
console.log('Update successful');
