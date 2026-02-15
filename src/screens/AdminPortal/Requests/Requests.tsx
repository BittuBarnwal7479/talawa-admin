/**
 * Requests screen for membership requests in an organization.
 *
 * Displays pending membership requests with search and role-based access
 * control. Shows empty states for no orgs, no results, and no pending requests.
 *
 * Features:
 * - Name search via SearchFilterBar.
 * - Accept/reject actions with toast feedback.
 *
 * Data:
 * - Uses `MEMBERSHIP_REQUEST_PG` query.
 * - Uses `ACCEPT_ORGANIZATION_REQUEST_MUTATION` and
 *   `REJECT_ORGANIZATION_REQUEST_MUTATION`.
 *
 * @remarks
 * Only administrators and superadmins can access this screen; others are redirected to
 * `/admin/orglist`.
 *
 * @returns The rendered Requests component.
 */
import { useQuery, useMutation } from '@apollo/client';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSimpleTableData } from 'shared-components/DataTable/hooks/useSimpleTableData';
import Button from 'shared-components/Button';
import { useTranslation } from 'react-i18next';
import { NotificationToast } from 'components/NotificationToast/NotificationToast';
import {
  ACCEPT_ORGANIZATION_REQUEST_MUTATION,
  REJECT_ORGANIZATION_REQUEST_MUTATION,
} from 'GraphQl/Mutations/mutations';
import { errorHandler } from 'utils/errorHandler';
import {
  MEMBERSHIP_REQUEST_PG,
  ORGANIZATION_LIST,
} from 'GraphQl/Queries/Queries';
import TableLoader from 'components/TableLoader/TableLoader';
import type { IColumnDef } from 'types/shared-components/DataTable/column';
import Avatar from 'shared-components/Avatar/Avatar';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import styles from './Requests.module.css';
import useLocalStorage from 'utils/useLocalstorage';
import { useParams } from 'react-router';
import SearchFilterBar from 'shared-components/SearchFilterBar/SearchFilterBar';
import { PAGE_SIZE } from 'types/ReportingTable/utils';
import EmptyState from 'shared-components/EmptyState/EmptyState';
import { Group, Search } from '@mui/icons-material';
import { DataTable } from 'shared-components/DataTable/DataTable';
import ErrorPanel from 'shared-components/ErrorPanel';

type SortingOption =
  | 'name_asc'
  | 'name_desc'
  | 'email_asc'
  | 'email_desc'
  | 'newest'
  | 'oldest';
type StatusFilterOption = 'all' | 'pending' | 'accepted' | 'rejected';

interface InterfaceRequestsListItem {
  membershipRequestId: string;
  createdAt: string;
  status: string;
  user: {
    avatarURL?: string;
    id: string;
    name: string;
    emailAddress: string;
  };
}

interface InterfaceMembershipRequestsQueryData {
  organization?: {
    membershipRequests?: InterfaceRequestsListItem[];
  } | null;
}

/**
 * Renders the Membership Requests screen.
 *
 * Responsibilities:
 * - Displays pending membership requests
 * - Supports search submission via SearchFilterBar
 * - Shows user avatars and request details
 * - Handles accept and reject request actions
 * - Shows empty state when no requests exist
 *
 * Localization:
 * - Uses `common` and `requests` namespaces
 *
 * @returns JSX.Element
 */
const Requests = (): JSX.Element => {
  const { t } = useTranslation('translation');
  const { t: tCommon } = useTranslation('common');

  // Set the document title to the translated title for the requests page
  useEffect(() => {
    document.title = t('requests.title');
  }, [t]);

  // Hook for managing local storage
  const { getItem } = useLocalStorage();

  // Define constants and state variables
  const [searchByName, setSearchByName] = useState<string>('');
  const [sortingOption, setSortingOption] = useState<SortingOption>('newest');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilterOption>('pending');
  const [currentPage, setCurrentPage] = useState<number>(0);
  const userRole = getItem('role') as string;
  const { orgId = '' } = useParams();
  const organizationId = orgId;

  // Query to fetch membership requests
  const membershipRequestsQuery =
    useQuery<InterfaceMembershipRequestsQueryData>(MEMBERSHIP_REQUEST_PG, {
      variables: {
        input: {
          id: organizationId,
        },
        first: PAGE_SIZE,
        skip: currentPage * PAGE_SIZE,
        name_contains: searchByName,
      },
      notifyOnNetworkStatusChange: true,
    });

  // Memoized path function for useSimpleTableData (stable reference required)
  const extractRequests = useCallback(
    (data: InterfaceMembershipRequestsQueryData) =>
      data?.organization?.membershipRequests ?? [],
    [],
  );

  const {
    rows: allRequests,
    loading,
    error,
    refetch,
  } = useSimpleTableData<
    InterfaceRequestsListItem,
    InterfaceMembershipRequestsQueryData
  >(membershipRequestsQuery, {
    path: extractRequests,
  });

  const { data: orgsData } = useQuery(ORGANIZATION_LIST);

  // Filter by status and apply sorting
  const displayedRequests = useMemo(() => {
    // Apply status filter
    const filtered =
      statusFilter === 'all'
        ? allRequests
        : allRequests.filter(
            (req: InterfaceRequestsListItem) => req.status === statusFilter,
          );

    // Apply sorting
    const sorted = [...filtered];
    switch (sortingOption) {
      case 'name_asc':
        return sorted.sort((a, b) =>
          (a.user?.name || '').localeCompare(b.user?.name || ''),
        );
      case 'name_desc':
        return sorted.sort((a, b) =>
          (b.user?.name || '').localeCompare(a.user?.name || ''),
        );
      case 'email_asc':
        return sorted.sort((a, b) =>
          (a.user?.emailAddress || '').localeCompare(
            b.user?.emailAddress || '',
          ),
        );
      case 'email_desc':
        return sorted.sort((a, b) =>
          (b.user?.emailAddress || '').localeCompare(
            a.user?.emailAddress || '',
          ),
        );
      case 'newest':
        return sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      case 'oldest':
        return sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      default:
        return sorted;
    }
  }, [allRequests, sortingOption, statusFilter]);

  // Precompute request index map for O(1) serial number lookup
  const requestIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    displayedRequests.forEach(
      (req: InterfaceRequestsListItem, index: number) => {
        map.set(req.membershipRequestId, index + 1);
      },
    );
    return map;
  }, [displayedRequests]);

  // Clear search on unmount
  useEffect(() => {
    return () => {
      setSearchByName('');
    };
  }, []);

  // Check for organizations
  useEffect(() => {
    if (!orgsData) {
      return;
    }

    // Add null check before accessing organizations.length
    if (orgsData.organizations?.length === 0) {
      NotificationToast.warning(t('requests.noOrgError') as string);
    }
  }, [orgsData, t]);

  // Check authorization
  useEffect(() => {
    const rawSuperAdmin = getItem('SuperAdmin');
    const isSuperAdmin =
      rawSuperAdmin === true ||
      rawSuperAdmin === 'true' ||
      rawSuperAdmin === 'True';
    const isAdmin = userRole?.toLowerCase() === 'administrator';
    if (!(isAdmin || isSuperAdmin)) {
      window.location.assign('/admin/orglist');
    }
  }, [userRole]);

  /**
   * Handles the search input change and updates the search term.
   *
   * @param value - The search term entered by the user.
   */
  const handleSearch = (value: string): void => {
    setSearchByName(value);
    setCurrentPage(0); // Reset to first page on search
  };

  /**
   * Handles sorting option change.
   *
   * @param value - The sorting option selected.
   */
  const handleSorting = (value: string): void => {
    const validSortOptions: SortingOption[] = [
      'name_asc',
      'name_desc',
      'email_asc',
      'email_desc',
      'newest',
      'oldest',
    ];
    if (validSortOptions.includes(value as SortingOption)) {
      setSortingOption(value as SortingOption);
      setCurrentPage(0); // Reset to first page on sort change
    }
  };

  /**
   * Handles status filter change.
   *
   * @param value - The status filter option selected.
   */
  const handleStatusFilter = (value: string): void => {
    const validStatusOptions: StatusFilterOption[] = [
      'all',
      'pending',
      'accepted',
      'rejected',
    ];
    if (validStatusOptions.includes(value as StatusFilterOption)) {
      setStatusFilter(value as StatusFilterOption);
      setCurrentPage(0); // Reset to first page on filter change
    }
  };

  /**
   * Handles pagination - go to next page.
   */
  const handleNextPage = (): void => {
    setCurrentPage((prev) => prev + 1);
  };

  /**
   * Handles pagination - go to previous page.
   */
  const handlePrevPage = (): void => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  // Header titles for the table
  const headerTitles: string[] = [
    t('requests.sl_no'),
    t('requests.profile'),
    tCommon('name'),
    tCommon('email'),
    t('requests.accept'),
    t('requests.reject'),
  ];

  // Mutations for accept/reject
  const [acceptUser] = useMutation(ACCEPT_ORGANIZATION_REQUEST_MUTATION);
  const [rejectUser] = useMutation(REJECT_ORGANIZATION_REQUEST_MUTATION);

  const handleAcceptUser = async (membershipRequestId: string) => {
    try {
      const { data: acceptData } = await acceptUser({
        variables: { input: { membershipRequestId } },
      });
      if (acceptData?.acceptMembershipRequest?.success) {
        NotificationToast.success(t('requests.acceptedSuccessfully') as string);
        refetch();
      } else {
        const errorMessage =
          acceptData?.acceptMembershipRequest?.message ||
          (t('users.errorOccurred') as string);
        NotificationToast.error(errorMessage);
      }
    } catch (error: unknown) {
      errorHandler(t, error);
    }
  };

  const handleRejectUser = async (membershipRequestId: string) => {
    try {
      const { data: rejectData } = await rejectUser({
        variables: { input: { membershipRequestId } },
      });
      if (rejectData?.rejectMembershipRequest?.success) {
        NotificationToast.success(t('requests.rejectedSuccessfully') as string);
        refetch();
      } else {
        const errorMessage =
          rejectData?.rejectMembershipRequest?.message ||
          (t('users.errorOccurred') as string);
        NotificationToast.error(errorMessage);
      }
    } catch (error: unknown) {
      errorHandler(t, error);
    }
  };

  // Columns for DataTable
  const columns: Array<IColumnDef<InterfaceRequestsListItem>> = [
    {
      id: 'sl_no',
      header: t('requests.sl_no'),
      accessor: (): number => 0,
      render: (_: unknown, req: InterfaceRequestsListItem): JSX.Element => (
        <span data-testid={`serial-${req.membershipRequestId}`}>
          {requestIndexMap.get(req.membershipRequestId) || 0}
        </span>
      ),
    },
    {
      id: 'profile',
      header: t('requests.profile'),
      accessor: (req: InterfaceRequestsListItem) => req.user?.id || '',
      render: (_: unknown, req: InterfaceRequestsListItem) => {
        const user = req.user || {};
        if (user.avatarURL && user.avatarURL !== 'null') {
          return (
            <img
              src={user.avatarURL}
              className={styles.userAvatar}
              alt={t('requests.profilePictureAlt')}
              data-testid="display-img"
              crossOrigin="anonymous"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.style.display = 'none';
              }}
            />
          );
        }
        return (
          <Avatar
            data-testid="display-img"
            size={45}
            avatarStyle={styles.avatarStyle}
            name={user.name || ''}
            alt={t('requests.placeholderAvatarAlt')}
          />
        );
      },
    },
    {
      id: 'name',
      header: tCommon('name'),
      accessor: (req: InterfaceRequestsListItem) => req.user?.name || '',
    },
    {
      id: 'email',
      header: tCommon('email'),
      accessor: (req: InterfaceRequestsListItem) =>
        req.user?.emailAddress || '',
    },
    {
      id: 'accept',
      header: t('requests.accept'),
      accessor: (req: InterfaceRequestsListItem) => req.membershipRequestId,
      render: (_: unknown, req: InterfaceRequestsListItem) => (
        <Button
          className={
            'btn ' + styles.requestsAcceptButton + ' ' + styles.hoverShadowOnly
          }
          data-testid={'acceptMembershipRequestBtn' + req.membershipRequestId}
          aria-label={t('requests.accept')}
          onClick={async () => {
            await handleAcceptUser(req.membershipRequestId);
          }}
        >
          <CheckCircleIcon />
        </Button>
      ),
    },
    {
      id: 'reject',
      header: t('requests.reject'),
      accessor: (req: InterfaceRequestsListItem) => req.membershipRequestId,
      render: (_: unknown, req: InterfaceRequestsListItem) => (
        <Button
          className={
            'btn ' + styles.requestsRejectButton + ' ' + styles.hoverShadowOnly
          }
          data-testid={'rejectMembershipRequestBtn' + req.membershipRequestId}
          aria-label={t('requests.reject')}
          onClick={async () => {
            await handleRejectUser(req.membershipRequestId);
          }}
        >
          <DeleteIcon />
        </Button>
      ),
    },
  ];

  return (
    <div data-testid="testComp">
      <SearchFilterBar
        searchPlaceholder={t('requests.searchRequests')}
        searchValue={searchByName}
        onSearchChange={handleSearch}
        onSearchSubmit={handleSearch}
        searchInputTestId="searchByName"
        searchButtonTestId="searchButton"
        hasDropdowns={true}
        dropdowns={[
          {
            id: 'requests-sort',
            label: tCommon('sortBy'),
            type: 'sort',
            options: [
              { label: tCommon('Latest'), value: 'newest' },
              { label: tCommon('Oldest'), value: 'oldest' },
              { label: tCommon('nameAsc'), value: 'name_asc' },
              { label: tCommon('nameDesc'), value: 'name_desc' },
              { label: tCommon('emailAsc'), value: 'email_asc' },
              { label: tCommon('emailDesc'), value: 'email_desc' },
            ],
            selectedOption: sortingOption,
            onOptionChange: (value) => handleSorting(value.toString()),
            dataTestIdPrefix: 'sortRequests',
          },
          {
            id: 'requests-status-filter',
            label: tCommon('status'),
            type: 'filter',
            options: [
              { label: t('requests.pending'), value: 'pending' },
              { label: t('requests.accepted'), value: 'accepted' },
              { label: t('requests.rejected'), value: 'rejected' },
              { label: tCommon('all'), value: 'all' },
            ],
            selectedOption: statusFilter,
            onOptionChange: (value) => handleStatusFilter(value.toString()),
            dataTestIdPrefix: 'filterRequestsStatus',
          },
        ]}
      />

      {error ? (
        <ErrorPanel
          message={t('requests.errorLoadingRequests')}
          error={error}
          onRetry={refetch}
          testId="errorRequests"
        />
      ) : !loading && orgsData?.organizations?.length === 0 ? (
        <EmptyState
          icon={<Group />}
          message={t('requests.noOrgErrorTitle')}
          description={t('requests.noOrgErrorDescription')}
          dataTestId="requests-no-orgs-empty"
        />
      ) : !loading &&
        displayedRequests.length === 0 &&
        searchByName.length > 0 ? (
        <EmptyState
          icon={<Search />}
          message={tCommon('noResultsFoundFor', {
            query: searchByName,
          })}
          description={tCommon('tryAdjustingFilters')}
          dataTestId="requests-search-empty"
        />
      ) : !loading && displayedRequests.length === 0 ? (
        <EmptyState
          icon={<Group />}
          message={t('requests.noRequestsFound')}
          description={t('requests.newMembersWillAppearHere')}
          dataTestId="requests-no-requests-empty"
        />
      ) : (
        <div className={styles.listBox}>
          {loading ? (
            <TableLoader headerTitles={headerTitles} noOfRows={PAGE_SIZE} />
          ) : (
            <>
              <DataTable<InterfaceRequestsListItem>
                data={displayedRequests}
                columns={columns}
                rowKey="membershipRequestId"
              />
              {(displayedRequests.length >= PAGE_SIZE || currentPage > 0) && (
                <div
                  className="d-flex justify-content-between align-items-center p-3"
                  role="navigation"
                  aria-label={tCommon('pagination')}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={currentPage === 0}
                    data-testid="prevPageBtn"
                  >
                    {tCommon('previous')}
                  </Button>
                  <span data-testid="pageIndicator" aria-live="polite">
                    {tCommon('page')} {currentPage + 1}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={allRequests.length < PAGE_SIZE}
                    data-testid="nextPageBtn"
                  >
                    {tCommon('next')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Requests;
