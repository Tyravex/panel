import { Link } from "react-router-dom";
interface AdminSectionPageProps { title: string; description: string; planned?: boolean }
export const AdminSectionPage = ({ title, description, planned = false }: AdminSectionPageProps) => (
  <div className="space-y-6">
    <div><p className="mb-2 text-sm font-medium text-primary">Tyravex / Administration</p><h1 className="text-3xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-text-secondary">{description}</p></div>
    <section className="rounded-2xl border border-border-subtle bg-surface p-6">
      <p className="font-semibold">{planned ? "Module in development" : "Administration workspace"}</p>
      <p className="mt-2 text-sm text-text-secondary">{planned ? "This screen does not yet provide live management operations." : "Select a section in the administration sidebar."}</p>
      <Link to="/admin/users" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">Open user management</Link>
    </section>
  </div>
);
