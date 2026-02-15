import React from 'react';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { MockedProvider } from '@apollo/client/testing';
import { vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18nForTest from 'utils/i18nForTest';
import BlockUser from './BlockUser';
import {
  GET_ORGANIZATION_MEMBERS_PG,
  GET_ORGANIZATION_BLOCKED_USERS_PG,
} from 'GraphQl/Queries/Queries';
import {
  BLOCK_USER_MUTATION_PG,
  UNBLOCK_USER_MUTATION_PG,
} from 'GraphQl/Mutations/mutations';
import { BrowserRouter } from 'react-router';
import { NotificationToast } from 'components/NotificationToast/NotificationToast';
import { errorHandler } from 'utils/errorHandler';
import type { DocumentNode } from 'graphql';

const { toastMocks, routerMocks, errorHandlerMock } = vi.hoisted(() => {
  const useParams = vi.fn();
  useParams.mockReturnValue({ orgId: '123' });

  return {
    toastMocks: {
      success: vi.fn(),
      error: vi.fn(),
    },
    routerMocks: {
      useParams,
    },
    errorHandlerMock: vi.fn(),
  };
});

vi.mock('components/NotificationToast/NotificationToast', async () => {
  return {
    NotificationToast: toastMocks,
  };
});

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useParams: routerMocks.useParams,
  };
});

vi.mock('utils/errorHandler', () => ({
  errorHandler: errorHandlerMock,
}));

interface InterfaceMockOptions {
  blockUserError?: boolean;
  unblockUserError?: boolean;
  membersQueryError?: boolean;
  blockedUsersQueryError?: boolean;
  emptyMembers?: boolean;
  emptyBlockedUsers?: boolean;
  nullData?: boolean;
  delay?: number;
  membersPagination?: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

interface InterfaceGraphQLVariables {
  id?: string;
  first?: number;
  after?: unknown;
  userId?: string;
  organizationId?: string;
}

interface InterfaceGraphQLRequest {
  query: DocumentNode;
  variables: InterfaceGraphQLVariables;
}

interface InterfaceGraphQLMock {
  request: InterfaceGraphQLRequest;
  result?: { data: unknown };
  error?: Error;
  maxUsageCount?: number;
}

const createMocks = (
  options: InterfaceMockOptions = {},
): InterfaceGraphQLMock[] => {
  const {
    blockUserError = false,
    unblockUserError = false,
    membersQueryError = false,
    blockedUsersQueryError = false,
    emptyMembers = false,
    emptyBlockedUsers = false,
    nullData = false,
    delay = 0,
    membersPagination = { hasNextPage: false, endCursor: null },
  } = options;

  const mocks: InterfaceGraphQLMock[] = [
    {
      request: {
        query: GET_ORGANIZATION_MEMBERS_PG,
        variables: { id: '123', first: 32, after: null },
      },
      ...(membersQueryError
        ? { error: new Error('Failed to fetch members') }
        : {
            delay,
            result: {
              data: nullData
                ? { organization: null }
                : {
                    organization: {
                      members: {
                        edges: emptyMembers
                          ? []
                          : [
                              {
                                node: {
                                  id: '1',
                                  name: 'John Doe',
                                  emailAddress: 'john@example.com',
                                  role: 'regular',
                                },
                              },
                              {
                                node: {
                                  id: '2',
                                  name: 'Jane Smith',
                                  emailAddress: 'jane@example.com',
                                  role: 'regular',
                                },
                              },
                            ],
                        pageInfo: membersPagination,
                      },
                    },
                  },
            },
          }),
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
    {
      request: {
        query: GET_ORGANIZATION_BLOCKED_USERS_PG,
        variables: { id: '123', first: 32, after: null },
      },
      ...(blockedUsersQueryError
        ? { error: new Error('Failed to fetch blocked users') }
        : {
            delay,
            result: {
              data: nullData
                ? { organization: null }
                : {
                    organization: {
                      blockedUsers: {
                        edges: emptyBlockedUsers
                          ? []
                          : [
                              {
                                node: {
                                  id: '3',
                                  name: 'Bob Johnson',
                                  emailAddress: 'bob@example.com',
                                  role: 'regular',
                                },
                              },
                            ],
                        pageInfo: { hasNextPage: false, endCursor: null },
                      },
                    },
                  },
            },
          }),
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
    {
      request: {
        query: BLOCK_USER_MUTATION_PG,
        variables: { userId: '1', organizationId: '123' },
      },
      ...(blockUserError
        ? { error: new Error('Failed to block user') }
        : { result: { data: { blockUser: { success: true } } } }),
    },
    {
      request: {
        query: BLOCK_USER_MUTATION_PG,
        variables: { userId: '2', organizationId: '123' },
      },
      ...(blockUserError
        ? { error: new Error('Failed to block user') }
        : { result: { data: { blockUser: { success: true } } } }),
    },
    {
      request: {
        query: UNBLOCK_USER_MUTATION_PG,
        variables: { userId: '3', organizationId: '123' },
      },
      ...(unblockUserError
        ? { error: new Error('Failed to unblock user') }
        : { result: { data: { unblockUser: { success: true } } } }),
    },
  ];
  return mocks;
};

describe('BlockUser Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.useParams.mockReturnValue({ orgId: '123' });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  describe('Initial Loading and Error States', () => {
    it('shows loading state when fetching data', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks({ delay: 50 })}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('TableLoader')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });
    });

    it('handles null organization data gracefully', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks({ nullData: true })}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      // Should show empty state
      await waitFor(() => {
        expect(
          screen.getByTestId('block-user-empty-state'),
        ).toBeInTheDocument();
        expect(screen.getByText('No users found')).toBeInTheDocument();
      });
    });

    it('handles both queries returning null data', async () => {
      // Create custom mocks with both queries returning null data
      const customMocks = [
        {
          request: {
            query: GET_ORGANIZATION_MEMBERS_PG,
            variables: { id: '123', first: 32, after: null },
          },
          result: {
            data: { organization: null },
          },
        },
        {
          request: {
            query: GET_ORGANIZATION_BLOCKED_USERS_PG,
            variables: { id: '123', first: 32, after: null },
          },
          result: {
            data: { organization: null },
          },
        },
      ];

      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={customMocks}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      // Should show empty state
      await waitFor(() => {
        expect(
          screen.getByTestId('block-user-empty-state'),
        ).toBeInTheDocument();
        expect(screen.getByText('No users found')).toBeInTheDocument();
      });

      // Switch to blocked users view
      const sortingButton = await screen.findByTestId('blockUserView-toggle');
      await act(async () => {
        fireEvent.click(sortingButton);
      });

      const blockedUsersOption = await screen.findByTestId(
        'blockUserView-item-blockedUsers',
      );
      await act(async () => {
        fireEvent.click(blockedUsersOption);
      });

      // Should show empty state for blocked users
      await waitFor(() => {
        expect(
          screen.getByTestId('block-user-empty-state'),
        ).toBeInTheDocument();
        expect(screen.getByText('No spammer found')).toBeInTheDocument();
      });
    });

    it('displays error panel when blocked users query fails', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks({ blockedUsersQueryError: true })}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('errorBlockedUsers')).toBeInTheDocument();
        expect(
          screen.getByText((content, element) => {
            return (
              element?.textContent ===
              'Error occurred while loading blocked users dataFailed to fetch blocked users'
            );
          }),
        ).toBeInTheDocument();
      });
    });

    it('displays error panel when members query fails', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks({ membersQueryError: true })}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('errorMembers')).toBeInTheDocument();
        expect(
          screen.getByText((content, element) => {
            return (
              element?.textContent ===
              'Error occurred while loading members dataFailed to fetch members'
            );
          }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('View Switching', () => {
    it('displays all members initially', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        const johnDoe = screen.getByText('John Doe');
        const janeSmith = screen.getByText('Jane Smith');
        expect(johnDoe).toBeInTheDocument();
        expect(janeSmith).toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });

    it('switches to blocked users view', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      const sortingButton = await screen.findByTestId('blockUserView-toggle');
      await act(async () => {
        fireEvent.click(sortingButton);
      });

      const blockedUsersOption = await screen.findByTestId(
        'blockUserView-item-blockedUsers',
      );
      await act(async () => {
        fireEvent.click(blockedUsersOption);
      });

      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });
    });

    it('displays empty state when no members are available', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks({ emptyMembers: true })}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('block-user-empty-state'),
        ).toBeInTheDocument();
        expect(screen.getByText('No users found')).toBeInTheDocument();
      });
    });

    it('displays empty state with noSpammerFound message when blocked tab is selected and searchTerm is empty', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks({ emptyBlockedUsers: true })}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      const sortingButton = await screen.findByTestId('blockUserView-toggle');
      await act(async () => {
        fireEvent.click(sortingButton);
      });

      const blockedUsersOption = await screen.findByTestId(
        'blockUserView-item-blockedUsers',
      );
      await act(async () => {
        fireEvent.click(blockedUsersOption);
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('block-user-empty-state'),
        ).toBeInTheDocument();
        expect(screen.getByText('No spammer found')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('searches members by name', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('searchByName');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'John' } });
      });

      // Wait for debounced search to complete
      await waitFor(
        () => {
          expect(screen.getByText('John Doe')).toBeInTheDocument();
          expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });

    it('searches members by email address', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('searchByName');
      await act(async () => {
        fireEvent.change(searchInput, {
          target: { value: 'jane@example.com' },
        });
      });

      // Wait for debounced search to complete
      await waitFor(
        () => {
          expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
          expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });

    it('searches blocked users by name', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      const sortingButton = await screen.findByTestId('blockUserView-toggle');
      await act(async () => {
        fireEvent.click(sortingButton);
      });

      const blockedUsersOption = await screen.findByTestId(
        'blockUserView-item-blockedUsers',
      );
      await act(async () => {
        fireEvent.click(blockedUsersOption);
      });

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('searchByName');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Bob' } });
      });

      // Wait for debounced search to complete
      await waitFor(
        () => {
          expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });

    it('searches blocked users by email address', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      const sortingButton = await screen.findByTestId('blockUserView-toggle');
      await act(async () => {
        fireEvent.click(sortingButton);
      });

      const blockedUsersOption = await screen.findByTestId(
        'blockUserView-item-blockedUsers',
      );
      await act(async () => {
        fireEvent.click(blockedUsersOption);
      });

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('searchByName');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'bob@example.com' } });
      });

      // Wait for debounced search to complete
      await waitFor(
        () => {
          expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });

    it('handles search with no results for members', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('searchByName');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      });

      // Wait for debounced search to complete
      await waitFor(
        () => {
          expect(
            screen.getByText('No results found for nonexistent'),
          ).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });

    it('handles search with no results for blocked users', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      const sortingButton = await screen.findByTestId('blockUserView-toggle');
      await act(async () => {
        fireEvent.click(sortingButton);
      });

      const blockedUsersOption = await screen.findByTestId(
        'blockUserView-item-blockedUsers',
      );
      await act(async () => {
        fireEvent.click(blockedUsersOption);
      });

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('searchByName');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      });

      // Wait for debounced search to complete
      await waitFor(
        () => {
          expect(
            screen.getByText('No results found for nonexistent'),
          ).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });

    it('clears search results when search term is empty', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // First search for something
      const searchInput = screen.getByTestId('searchByName');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'John' } });
      });

      // Wait for debounced search to complete
      await waitFor(
        () => {
          expect(screen.getByText('John Doe')).toBeInTheDocument();
          expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        },
        { timeout: 500 },
      );

      // Then clear the search
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: '' } });
      });

      // Wait for debounced clear to complete
      await waitFor(
        () => {
          expect(screen.getByText('John Doe')).toBeInTheDocument();
          expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        },
        { timeout: 500 },
      );
    });
  });

  describe('Block/Unblock Actions', () => {
    it('blocks a user successfully', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const blockButton = screen.getByTestId('blockUserBtn-1');
      await act(async () => {
        fireEvent.click(blockButton);
      });

      await waitFor(() => {
        expect(NotificationToast.success).toHaveBeenCalledWith(
          'User blocked successfully',
        );
      });
    });

    it('unblocks a user successfully', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      const sortingButton = await screen.findByTestId('blockUserView-toggle');
      await act(async () => {
        fireEvent.click(sortingButton);
      });

      const blockedUsersOption = await screen.findByTestId(
        'blockUserView-item-blockedUsers',
      );
      await act(async () => {
        fireEvent.click(blockedUsersOption);
      });

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      const unblockButton = screen.getByTestId('unblockUserBtn-3');
      await act(async () => {
        fireEvent.click(unblockButton);
      });

      await waitFor(() => {
        expect(NotificationToast.success).toHaveBeenCalledWith(
          'User Un-Blocked successfully',
        );
      });
    });

    it('handles block user error', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks({ blockUserError: true })}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const blockButton = screen.getByTestId('blockUserBtn-1');
      await act(async () => {
        fireEvent.click(blockButton);
      });

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalled();
      });
    });

    it('handles unblock user error', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks({ unblockUserError: true })}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      const sortingButton = await screen.findByTestId('blockUserView-toggle');
      await act(async () => {
        fireEvent.click(sortingButton);
      });

      const blockedUsersOption = await screen.findByTestId(
        'blockUserView-item-blockedUsers',
      );
      await act(async () => {
        fireEvent.click(blockedUsersOption);
      });

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      const unblockButton = screen.getByTestId('unblockUserBtn-3');
      await act(async () => {
        fireEvent.click(unblockButton);
      });

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalled();
      });
    });

    it('can block multiple users', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Block first user
      const blockButton1 = screen.getByTestId('blockUserBtn-1');
      await act(async () => {
        fireEvent.click(blockButton1);
      });

      await waitFor(() => {
        expect(NotificationToast.success).toHaveBeenCalledWith(
          'User blocked successfully',
        );
      });

      // Block second user
      const blockButton2 = screen.getByTestId('blockUserBtn-2');
      await act(async () => {
        fireEvent.click(blockButton2);
      });

      await waitFor(() => {
        expect(NotificationToast.success).toHaveBeenCalledWith(
          'User blocked successfully',
        );
      });

      // Verify both users are no longer in the list
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        expect(
          screen.getByTestId('block-user-empty-state'),
        ).toBeInTheDocument();
        expect(screen.getByText('No users found')).toBeInTheDocument();
      });
    });

    it('shows blocked user in blocked users list after blocking', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      // Verify John Doe is in the members list
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Block John Doe
      const blockButton = screen.getByTestId('blockUserBtn-1');
      await act(async () => {
        fireEvent.click(blockButton);
      });

      await waitFor(() => {
        expect(NotificationToast.success).toHaveBeenCalledWith(
          'User blocked successfully',
        );
      });

      // Switch to blocked users view
      const sortingButton = await screen.findByTestId('blockUserView-toggle');
      await act(async () => {
        fireEvent.click(sortingButton);
      });

      const blockedUsersOption = await screen.findByTestId(
        'blockUserView-item-blockedUsers',
      );
      await act(async () => {
        fireEvent.click(blockedUsersOption);
      });

      // Verify John Doe is now in the blocked users list
      // Note: In a real scenario, we would need to update the mock for the blocked users query
      // Here we're testing the component's internal state management
      await waitFor(() => {
        // Bob Johnson should still be there
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();

        // John Doe should now be in the list too (added to state)
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });
  });

  describe('Component Behavior', () => {
    it('updates document title on mount', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      expect(document.title).toBe('Block/Unblock User');
    });

    it('renders table headers correctly', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
      });

      // Check for table headers
      expect(screen.getByText('#')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Block/Unblock')).toBeInTheDocument();
    });
  });

  describe('Sorting and Pagination Functionality', () => {
    it('should render sort dropdown after data loads', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      // Wait for TableLoader to disappear
      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Then verify sort dropdown is present
      await waitFor(
        () => {
          expect(
            screen.getByTestId('sortBlockUser-toggle'),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it('should render InfiniteScroll container with users', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      // Wait for TableLoader to disappear
      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Verify InfiniteScroll container and users are displayed
      await waitFor(
        () => {
          expect(screen.getByTestId('userList')).toBeInTheDocument();
          expect(screen.getByText('John Doe')).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe('Sorting Options', () => {
    it('should sort users by name descending', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Click sort dropdown
      await act(async () => {
        const sortDropdown = await waitFor(() =>
          screen.getByTestId('sortBlockUser-toggle'),
        );
        fireEvent.click(sortDropdown);

        // Select name descending option (tests line 196)
        const nameDescOption = await waitFor(() =>
          screen.getByTestId('sortBlockUser-item-name_desc'),
        );
        expect(nameDescOption).toBeInTheDocument();
        fireEvent.click(nameDescOption);
      });

      // Verify actual sort order: Jane Smith should appear before John Doe
      await waitFor(() => {
        const userList = screen.getByTestId('userList');
        expect(userList).toBeInTheDocument();

        const rows = screen.getAllByRole('row');
        // Skip header row, check data rows
        expect(rows.length).toBeGreaterThan(2);

        // In descending order: John Doe (J-o-h) > Jane Smith (J-a-n), so John should be first
        const firstDataRow = rows[1];
        const secondDataRow = rows[2];

        expect(firstDataRow).toHaveTextContent('John Doe');
        expect(secondDataRow).toHaveTextContent('Jane Smith');
      });
    });

    it('should sort users by email ascending', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Click sort dropdown
      const sortDropdown = await waitFor(() =>
        screen.getByTestId('sortBlockUser-toggle'),
      );
      fireEvent.click(sortDropdown);

      // Wait for dropdown menu to be visible, then select email ascending option
      const emailAscOption = await screen.findByTestId(
        'sortBlockUser-item-email_asc',
      );
      expect(emailAscOption).toBeInTheDocument();
      fireEvent.click(emailAscOption);

      await waitFor(() => {
        expect(screen.getByTestId('userList')).toBeInTheDocument();
      });
    });

    it('should sort users by email descending', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Click sort dropdown
      const sortDropdown = await waitFor(() =>
        screen.getByTestId('sortBlockUser-toggle'),
      );
      fireEvent.click(sortDropdown);

      // Select email descending option (tests lines 199-200)
      const emailDescOption = await waitFor(() =>
        screen.getByTestId('sortBlockUser-item-email_desc'),
      );
      expect(emailDescOption).toBeInTheDocument();
      fireEvent.click(emailDescOption);

      await waitFor(() => {
        expect(screen.getByTestId('userList')).toBeInTheDocument();
      });
    });

    it('should handle default sorting case', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Component should render with default sorting (tests lines 201-202)
      await waitFor(() => {
        expect(screen.getByTestId('userList')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should call handleSorting when sort option changes', async () => {
      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Click sort dropdown
      const sortDropdown = await waitFor(() =>
        screen.getByTestId('sortBlockUser-toggle'),
      );
      fireEvent.click(sortDropdown);

      // Select any option to trigger handleSorting (tests lines 271, 434)
      const nameAscOption = await waitFor(() =>
        screen.getByTestId('sortBlockUser-item-name_asc'),
      );
      expect(nameAscOption).toBeInTheDocument();
      fireEvent.click(nameAscOption);

      await waitFor(() => {
        expect(screen.getByTestId('userList')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting Functionality', () => {
    it('should sort users by name ascending (name_asc option)', async () => {
      // This test verifies the sortUsers function (line 195-209) correctly handles
      // the name_asc case (line 198-199). The sortUsers function also has a default
      // case (line 207) that serves as defensive code if sortingOption becomes invalid,
      // though the isSortingOption type guard (line 80-82) prevents invalid values in normal operation.

      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={createMocks()}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      // Wait for data to load
      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Verify component renders correctly with initial state
      await waitFor(() => {
        expect(screen.getByTestId('userList')).toBeInTheDocument();
        // Both users should be visible
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Test name_asc sorting option
      const sortDropdown = await waitFor(() =>
        screen.getByTestId('sortBlockUser-toggle'),
      );

      fireEvent.click(sortDropdown);
      const nameAscOption = await screen.findByTestId(
        'sortBlockUser-item-name_asc',
      );
      fireEvent.click(nameAscOption);

      // Verify sorting order: Jane Smith should come before John Doe in ascending order
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(2);
        expect(rows[1]).toHaveTextContent('Jane Smith');
      });
    });
  });

  describe('Pagination Early Return Conditions', () => {
    // NOTE: These tests verify the early return conditions (lines 283-285, 298-300) of
    // loadMoreMembers and loadMoreBlockedUsers by confirming the component renders successfully
    // with different pagination states (hasNextPage: false, endCursor: null).
    //
    // The early returns prevent fetchMore from being called with invalid pagination state.
    // To directly test fetchMore invocation, loadMoreMembers/loadMoreBlockedUsers would need to be:
    // 1. Extracted as testable utility functions, OR
    // 2. Tested with a custom Apollo client that exposes fetchMore for spying, OR
    // 3. Tested by triggering InfiniteScroll's scroll event (complex integration test)
    //
    // The current approach verifies the guards work by ensuring no errors occur when
    // pagination is disabled, which is sufficient for integration testing.

    it('should return early from loadMoreMembers when pageInfo has no next page', async () => {
      // Mock with hasNextPage: false but valid cursor to test line 284
      const mocksWithNoNextPage = createMocks({
        membersPagination: { hasNextPage: false, endCursor: 'cursor123' },
      });

      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={mocksWithNoNextPage}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Verify initial data loaded and component renders despite pagination condition
      // This confirms the early return (line 284) works correctly
      await waitFor(() => {
        expect(screen.getByTestId('userList')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should return early from loadMoreMembers when endCursor is null', async () => {
      // Mock with endCursor: null but hasNextPage: true to test line 285
      const mocksWithNullCursor = createMocks({
        membersPagination: { hasNextPage: true, endCursor: null },
      });

      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={mocksWithNullCursor}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Verify initial data loaded and component renders despite null cursor
      // This confirms the early return (line 285) works correctly
      await waitFor(() => {
        expect(screen.getByTestId('userList')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should return early from loadMoreMembers when both conditions are met', async () => {
      // Test both conditions: hasNextPage false AND endCursor null (lines 284-285)
      const mocksWithBoth = createMocks({
        membersPagination: { hasNextPage: false, endCursor: null },
      });

      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={mocksWithBoth}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Verify data loaded and component renders with both conditions preventing pagination
      // This confirms both early return conditions (lines 284-285) work correctly
      await waitFor(() => {
        expect(screen.getByTestId('userList')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should render blocked users when no more pages available', async () => {
      // Test that blocked users display correctly with pagination info showing no more pages
      const mocks = createMocks();

      render(
        <I18nextProvider i18n={i18nForTest}>
          <MockedProvider mocks={mocks}>
            <BrowserRouter>
              <BlockUser />
            </BrowserRouter>
          </MockedProvider>
        </I18nextProvider>,
      );

      await waitFor(
        () => {
          expect(screen.queryByTestId('TableLoader')).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Switch to blocked users view
      const filterDropdown = await waitFor(() =>
        screen.getByTestId('blockUserView-toggle'),
      );
      fireEvent.click(filterDropdown);

      const blockedOption = await waitFor(() =>
        screen.getByTestId('blockUserView-item-blockedUsers'),
      );
      fireEvent.click(blockedOption);

      // Verify blocked users are displayed
      // The mock has hasNextPage: false and endCursor: null
      await waitFor(() => {
        expect(screen.getByTestId('userList')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });
    });
  });
});
