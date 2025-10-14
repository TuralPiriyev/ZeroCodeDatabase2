import React, { useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onExecute?: () => void;
  onSave?: () => void;
  onReady?: () => void;
}

const MonacoEditorWrapper: React.FC<Props> = ({ value, onChange, onExecute, onSave, onReady }) => {
  const editorRef = useRef<any>(null);
  const [fontSize] = useState(14);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    // basic SQL language set
    try {
      monaco.languages.register({ id: 'sql' });
    } catch (err) {}

    // keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecute && onExecute();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave && onSave();
    });

    // toggle comment
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      const action = editor.getAction('editor.action.commentLine');
      if (action && typeof action.run === 'function') action.run();
    });

    // notify ready
    onReady && onReady();
  };

  return (
    <div className="h-full min-h-0">
      <Editor
        height="100%"
        defaultLanguage="sql"
        language="sql"
        value={value}
        onChange={(v) => onChange(v || '')}
        onMount={handleMount}
        options={{
          fontSize,
          wordWrap: 'on',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          lineNumbers: 'on',
          smoothScrolling: true,
          tabSize: 2,
          formatOnType: true,
        }}
      />
    </div>
  );
};

export default MonacoEditorWrapper;
