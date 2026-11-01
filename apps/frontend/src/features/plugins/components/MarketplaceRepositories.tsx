import { useState } from 'react';
import {
    CheckCircle2,
    CircleMinus,
    Eye,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-react';

import type { MarketplaceRepository } from '@shared/types';

import { MarketplaceRepositoryDetails } from './MarketplaceRepositoryDetails';
import { useMarketplaceRepositories } from '../hooks/useMarketplaceRepositories';

type RepositoryStatus = MarketplaceRepository['status'];

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return 'Something went wrong. Please try again.';
}

function RepositoryStatusBadge({
    status,
}: {
    status: RepositoryStatus;
}) {
    const enabled = status === 'ENABLED';
    const Icon = enabled ? CheckCircle2 : CircleMinus;

    return (
        <span
            className={[
                'inline-flex items-center gap-1.5 rounded-full',
                'border px-2.5 py-1 text-xs font-medium',
                enabled
                    ? 'border-green-500/30 bg-green-500/10 text-green-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-400',
            ].join(' ')}
        >
            <Icon size={14} aria-hidden="true" />
            {enabled ? 'Enabled' : 'Disabled'}
        </span>
    );
}

export function MarketplaceRepositories() {
    const {
        repositories,
        loading,
        saving,
        error,
        refresh,
        createRepository,
        updateRepository,
        deleteRepository,
    } = useMarketplaceRepositories();

    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [deletingRepository, setDeletingRepository] =
        useState<MarketplaceRepository | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [selectedRepository, setSelectedRepository] =
        useState<MarketplaceRepository | null>(null);

    const isBusy = saving || busyId !== null;

    async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (isBusy || !name.trim() || !url.trim()) {
            return;
        }

        setActionError(null);

        try {
            await createRepository({
                name: name.trim(),
                url: url.trim(),
            });

            setName('');
            setUrl('');
        } catch (error) {
            setActionError(getErrorMessage(error));
        }
    }

    async function handleToggle(repository: MarketplaceRepository) {
        if (isBusy || repository.isOfficial) {
            return;
        }

        setActionError(null);
        setBusyId(repository.id);

        try {
            await updateRepository(repository.id, {
                status:
                    repository.status === 'ENABLED'
                        ? 'DISABLED'
                        : 'ENABLED',
            });
        } catch (error) {
            setActionError(getErrorMessage(error));
        } finally {
            setBusyId(null);
        }
    }

    function startEditing(repository: MarketplaceRepository) {
        if (isBusy || repository.isOfficial) {
            return;
        }

        setActionError(null);
        setEditingId(repository.id);
        setEditingName(repository.name);
    }

    async function handleRename(repository: MarketplaceRepository) {
        const trimmedName = editingName.trim();

        if (
            isBusy ||
            repository.isOfficial ||
            trimmedName.length < 2
        ) {
            return;
        }

        setActionError(null);
        setBusyId(repository.id);

        try {
            await updateRepository(repository.id, {
                name: trimmedName,
            });

            setEditingId(null);
            setEditingName('');
        } catch (error) {
            setActionError(getErrorMessage(error));
        } finally {
            setBusyId(null);
        }
    }

    async function handleDelete() {
        if (!deletingRepository || isBusy) {
            return;
        }

        setActionError(null);
        setBusyId(deletingRepository.id);

        try {
            await deleteRepository(deletingRepository.id);
            setDeletingRepository(null);
        } catch (error) {
            setActionError(getErrorMessage(error));
        } finally {
            setBusyId(null);
        }
    }

    if (selectedRepository) {
        return (
            <MarketplaceRepositoryDetails
                repository={selectedRepository}
                onBack={() => setSelectedRepository(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-border-subtle p-5">
                <div className="mb-5">
                    <h2 className="text-lg font-semibold">
                        Add repository
                    </h2>

                    <p className="mt-1 text-sm text-slate-400">
                        Add a community plugin registry using a public
                        HTTPS URL.
                    </p>
                </div>

                <form
                    onSubmit={(event) => void handleCreate(event)}
                    className="space-y-4"
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label
                                htmlFor="repository-name"
                                className="block text-sm font-medium"
                            >
                                Repository name
                            </label>

                            <input
                                id="repository-name"
                                type="text"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                placeholder="Community Plugins"
                                minLength={2}
                                maxLength={100}
                                required
                                disabled={isBusy}
                                className="w-full rounded-lg border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="repository-url"
                                className="block text-sm font-medium"
                            >
                                Registry URL
                            </label>

                            <input
                                id="repository-url"
                                type="url"
                                value={url}
                                onChange={(event) =>
                                    setUrl(event.target.value)
                                }
                                placeholder="https://plugins.example.org/registry.json"
                                required
                                disabled={isBusy}
                                className="w-full rounded-lg border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={
                                isBusy ||
                                name.trim().length < 2 ||
                                !url.trim()
                            }
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? (
                                <Loader2
                                    size={16}
                                    className="animate-spin"
                                />
                            ) : (
                                <Plus size={16} />
                            )}

                            Add repository
                        </button>
                    </div>
                </form>
            </section>

            <section className="rounded-xl border border-border-subtle p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Repositories
                        </h2>

                        <p className="mt-1 text-sm text-slate-400">
                            Manage official and community plugin sources.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => void refresh()}
                        disabled={loading || isBusy}
                        className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm transition-colors hover:bg-white/5 disabled:opacity-50"
                    >
                        <RefreshCw
                            size={15}
                            className={loading ? 'animate-spin' : ''}
                        />
                        Refresh
                    </button>
                </div>

                {error && (
                    <p
                        role="alert"
                        className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
                    >
                        Could not load repositories.
                    </p>
                )}

                {actionError && !deletingRepository && (
                    <p
                        role="alert"
                        className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
                    >
                        {actionError}
                    </p>
                )}

                {loading && repositories.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                        <Loader2
                            size={18}
                            className="animate-spin"
                        />
                        Loading repositories...
                    </div>
                ) : repositories.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border-subtle px-4 py-10 text-center text-sm text-slate-400">
                        No repositories available.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {repositories.map((repository) => {
                            const editing = editingId === repository.id;
                            const repositoryBusy =
                                isBusy || busyId === repository.id;

                            return (
                                <div
                                    key={repository.id}
                                    className="rounded-lg border border-border-subtle p-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1 space-y-2">
                                            {editing ? (
                                                <form
                                                    onSubmit={(event) => {
                                                        event.preventDefault();
                                                        void handleRename(
                                                            repository,
                                                        );
                                                    }}
                                                    className="flex flex-wrap items-center gap-2"
                                                >
                                                    <input
                                                        type="text"
                                                        value={editingName}
                                                        onChange={(event) =>
                                                            setEditingName(
                                                                event.target.value,
                                                            )
                                                        }
                                                        minLength={2}
                                                        maxLength={100}
                                                        required
                                                        autoFocus
                                                        disabled={repositoryBusy}
                                                        aria-label="New repository name"
                                                        className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500"
                                                    />

                                                    <button
                                                        type="submit"
                                                        disabled={
                                                            repositoryBusy ||
                                                            editingName.trim().length < 2
                                                        }
                                                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                                                    >
                                                        Save
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={repositoryBusy}
                                                        onClick={() =>
                                                            setEditingId(null)
                                                        }
                                                        aria-label="Cancel rename"
                                                        className="rounded-lg border border-border-subtle p-2"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </form>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="font-semibold">
                                                        {repository.name}
                                                    </h3>

                                                    {repository.isOfficial && (
                                                        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
                                                            Official
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <p className="break-all text-sm text-slate-400">
                                                {repository.url}
                                            </p>

                                            <RepositoryStatusBadge
                                                status={repository.status}
                                            />

                                            <div className="pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedRepository(
                                                            repository,
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm hover:bg-white/5"
                                                >
                                                    <Eye size={15} />
                                                    View plugins
                                                </button>
                                            </div>
                                        </div>

                                        {!repository.isOfficial && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={repositoryBusy}
                                                    onClick={() =>
                                                        startEditing(repository)
                                                    }
                                                    className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                                                >
                                                    <Pencil size={15} />
                                                    Rename
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={repositoryBusy}
                                                    onClick={() =>
                                                        void handleToggle(
                                                            repository,
                                                        )
                                                    }
                                                    className="rounded-lg border border-border-subtle px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                                                >
                                                    {repository.status ===
                                                        'ENABLED'
                                                        ? 'Disable'
                                                        : 'Enable'}
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={repositoryBusy}
                                                    onClick={() => {
                                                        setActionError(null);
                                                        setDeletingRepository(
                                                            repository,
                                                        );
                                                    }}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                                >
                                                    <Trash2 size={15} />
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {deletingRepository && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="delete-repository-title"
                        aria-describedby="delete-repository-description"
                        className="w-full max-w-md rounded-xl border border-border-subtle bg-slate-900 p-6 shadow-2xl"
                    >
                        <h2
                            id="delete-repository-title"
                            className="text-lg font-semibold"
                        >
                            Delete repository?
                        </h2>

                        <p
                            id="delete-repository-description"
                            className="mt-3 text-sm text-slate-400"
                        >
                            Are you sure you want to remove{' '}
                            <strong>{deletingRepository.name}</strong>?
                            Installed plugins will not be removed.
                        </p>

                        {actionError && (
                            <p
                                role="alert"
                                className="mt-4 text-sm text-red-400"
                            >
                                {actionError}
                            </p>
                        )}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                    setDeletingRepository(null);
                                    setActionError(null);
                                }}
                                className="rounded-lg border border-border-subtle px-4 py-2 text-sm disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDelete()}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {isBusy ? (
                                    <Loader2
                                        size={16}
                                        className="animate-spin"
                                    />
                                ) : (
                                    <Trash2 size={16} />
                                )}
                                Delete repository
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}