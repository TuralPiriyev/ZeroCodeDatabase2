/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsModal from '../../src/components/main/SettingsModal';
import api from '../../src/utils/api';

jest.mock('../../src/utils/api');

const mockedApi = api as any;

describe('SettingsModal snippets integration', () => {
  it('shows snippets after fetching', async () => {
    const fake = {
      data: {
        configured: true,
        connectionString: 'mysql://user:pw@127.0.0.1:3306/testdb',
        snippets: {
          php: { dsn: 'mysql:host=127.0.0.1;port=3306;dbname=testdb;charset=utf8mb4', env: 'DB_DSN=...', snippet: '<?php // sample' },
          node: { connectionCode: '// node code' }
        }
      }
    };
    mockedApi.get.mockResolvedValueOnce(fake);

    const onClose = jest.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);

    // Click Fetch
    const fetchBtn = await screen.findByText('Fetch');
    fireEvent.click(fetchBtn);

    await waitFor(() => expect(screen.getByText('PHP (PDO) — MySQL')).toBeInTheDocument());
    expect(screen.getByText('Copy .env')).toBeInTheDocument();
  });
});
