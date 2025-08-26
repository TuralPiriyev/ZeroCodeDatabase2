import '@testing-library/jest-dom';
import React from 'react';

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
})) as any;

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => ({
  Editor: ({ onChange, onMount }: any) => {
    React.useEffect(() => {
      if (onMount) {
        onMount({
          getModel: () => ({
            getValue: () => 'SELECT * FROM users;',
          }),
          updateOptions: jest.fn(),
          executeEdits: jest.fn(),
          focus: jest.fn(),
        }, {
          editor: {
            setModelMarkers: jest.fn(),
          },
          languages: {
            setLanguageConfiguration: jest.fn(),
            registerHoverProvider: jest.fn(),
          },
        });
      }
    }, [onMount]);

    return React.createElement('div', {
      'data-testid': 'monaco-editor',
      onChange: (e: any) => onChange?.(e.target.value),
    });
  },
}));

// Mock React Flow
jest.mock('reactflow', () => ({
  ReactFlow: ({ children }: any) => React.createElement('div', { 'data-testid': 'react-flow' }, children),
  Controls: () => React.createElement('div', { 'data-testid': 'react-flow-controls' }),
  Background: () => React.createElement('div', { 'data-testid': 'react-flow-background' }),
  useNodesState: () => [[], jest.fn(), jest.fn()],
  useEdgesState: () => [[], jest.fn(), jest.fn()],
  useReactFlow: () => ({
    setViewport: jest.fn(),
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  }),
  ReactFlowProvider: ({ children }: any) => children,
  addEdge: jest.fn(),
  Handle: () => React.createElement('div', { 'data-testid': 'react-flow-handle' }),
  Position: {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
  },
  BackgroundVariant: {
    Dots: 'dots',
    Lines: 'lines',
    Cross: 'cross',
  },
}));

// Mock SQL.js
jest.mock('sql.js', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({
    Database: jest.fn(() => ({
      run: jest.fn(),
      exec: jest.fn(() => [{ columns: ['id', 'name'], values: [[1, 'test']] }]),
    })),
  })),
}));

// Mock crypto for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
  },
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
})) as any;