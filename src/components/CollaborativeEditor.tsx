import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';

interface CollaborativeEditorProps {
  workspaceId: string;
  userId: string; // İstifadəçi ID-si
}

const CollaborativeEditor = ({ workspaceId, userId }: CollaborativeEditorProps) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [cursors, setCursors] = useState({}); // Uzaqdan gələn kursorları izləmək üçün state

  useEffect(() => {
    // WebSocket bağlantısını qur
    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', workspaceId }));
    };

    ws.onmessage = (event) => {
      const { type, payload } = JSON.parse(event.data);

      if (type === 'init') {
        editorRef.current?.setValue(payload.document);
        setCursors(payload.cursors);
      } else if (type === 'text-change') {
        editorRef.current?.executeEdits('', [
          { range: payload.range, text: payload.text, forceMoveMarkers: true },
        ]);
      } else if (type === 'cursor-update') {
        setCursors((prev) => ({ ...prev, [payload.userId]: payload.position }));
      }
    };

    ws.onclose = () => {
      ws.send(JSON.stringify({ type: 'leave', workspaceId }));
    };

    return () => ws.close();
  }, [workspaceId]);

  useEffect(() => {
    // Monaco Editor-u qur
    const editor = monaco.editor.create(document.getElementById('editor')!, {
      value: '',
      language: 'javascript',
      theme: 'vs-dark',
    });
    editorRef.current = editor;

    // Mətn dəyişikliklərini WebSocket-ə göndər
    editor.onDidChangeModelContent((event) => {
      const text = editor.getValue();
      const range = event.changes[0].range;
      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({ type: 'text-change', workspaceId, payload: { text, range } })
        );
      }
    });

    // Kursor dəyişikliklərini WebSocket-ə göndər
    editor.onDidChangeCursorPosition((event) => {
      const position = event.position;
      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({ type: 'cursor-update', workspaceId, payload: { userId, position } })
        );
      }
    });

    return () => editor.dispose();
  }, [userId]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div id="editor" style={{ height: '100%' }}></div>
      {Object.entries(cursors).map(([id, position]) => {
        const typedPosition = position as { lineNumber: number; column: number };
        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              top: typedPosition.lineNumber * 20, // Sətir hündürlüyünə uyğunlaşdır
              left: typedPosition.column * 8, // Simvol genişliyinə uyğunlaşdır
              backgroundColor: id === userId ? 'blue' : 'red',
              width: 2,
              height: 20,
            }}
          >
            {id !== userId && <span>{id}</span>}
          </div>
        );
      })}
    </div>
  );
};

export default CollaborativeEditor;