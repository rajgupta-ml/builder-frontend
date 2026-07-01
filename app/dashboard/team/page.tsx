"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { teamApi, type TeamMember, type TeamOrg, type TeamPolicy } from "@/api/team";

const SCOPE_CATALOG: Record<TeamOrg["platformAccess"][number], Array<{ scope: string; label: string }>> = {
  gle: [
    { scope: "gle:projects.read", label: "View projects" },
    { scope: "gle:projects.write", label: "Create / edit projects" },
    { scope: "gle:bids.read", label: "View bids" },
    { scope: "gle:bids.write", label: "Manage bids" },
    { scope: "gle:clients.read", label: "View clients" },
    { scope: "gle:clients.write", label: "Create / edit clients" },
    { scope: "gle:suppliers.read", label: "View suppliers" },
    { scope: "gle:suppliers.write", label: "Create / edit suppliers" },
    { scope: "gle:qualifications.read", label: "View qualifications" },
    { scope: "gle:qualifications.write", label: "Create / edit qualifications" },
    { scope: "gle:commissions.manage", label: "Manage commissions" },
    { scope: "gle:logs.read", label: "View audit logs" },
  ],
  survey_studio: [
    { scope: "survey_studio:survey.read", label: "View surveys" },
    { scope: "survey_studio:survey.create", label: "Create surveys" },
    { scope: "survey_studio:survey.edit", label: "Edit surveys" },
    { scope: "survey_studio:survey.delete", label: "Delete surveys" },
    { scope: "survey_studio:survey.publish", label: "Publish surveys" },
    { scope: "survey_studio:quota.manage", label: "Manage quotas" },
    { scope: "survey_studio:response.read", label: "View responses" },
    { scope: "survey_studio:response.export", label: "Export responses" },
    { scope: "survey_studio:response.share", label: "Share responses" },
    { scope: "survey_studio:reconciliation.manage", label: "Manage reconciliation" },
    { scope: "survey_studio:privacy.manage", label: "Manage respondent privacy" },
    { scope: "survey_studio:test.run", label: "Run tests" },
    { scope: "survey_studio:ops.read", label: "View system ops" },
    { scope: "survey_studio:ops.write", label: "Run system ops" },
  ],
  data_analysis: [
    { scope: "da:projects.read", label: "View analysis projects" },
    { scope: "da:projects.write", label: "Create projects / run analysis" },
    { scope: "da:reports.read", label: "View reports" },
    { scope: "da:reports.write", label: "Generate / publish reports" },
  ],
};

const PLATFORM_LABELS: Record<TeamOrg["platformAccess"][number], string> = {
  gle: "GLE Apex",
  survey_studio: "Survey Studios",
  data_analysis: "Insight Works",
};
const policyPlatform = (policy: TeamPolicy): TeamOrg["platformAccess"][number] | null =>
  (Object.keys(SCOPE_CATALOG) as TeamOrg["platformAccess"]).find(platform =>
    policy.scopes.every(scope => SCOPE_CATALOG[platform].some(item => item.scope === scope)),
  ) ?? null;

export default function TeamPage() {
  const router = useRouter();
  const [orgId, setOrgId] = useState("");
  const [org, setOrg] = useState<TeamOrg | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [policies, setPolicies] = useState<TeamPolicy[]>([]);
  const [activeTab, setActiveTab] = useState<"members" | "policies">("members");
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<TeamPolicy | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [nextOrg, nextMembers, nextPolicies] = await Promise.all([
        teamApi.org(id),
        teamApi.members(id),
        teamApi.policies(id),
      ]);
      setOrg(nextOrg);
      setMembers(nextMembers);
      setPolicies(nextPolicies);
    } catch {
      toast.error("Unable to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") ?? "{}") as {
        userId?: string; orgId?: string; isOrgOwner?: boolean;
      };
      if (!user.isOrgOwner || !user.orgId) {
        router.replace("/dashboard");
        return;
      }
      setOrgId(user.orgId);
      setCurrentUserId(user.userId ?? "");
      void load(user.orgId);
    } catch {
      router.replace("/dashboard");
    }
  }, [load, router]);

  const removeMember = async (member: TeamMember) => {
    if (!confirm(`Remove ${member.name} from your organisation? They will lose all access immediately.`)) return;
    try {
      await teamApi.removeMember(orgId, member.userId);
      toast.success("Member removed");
      await load(orgId);
    } catch { toast.error("Failed to remove member"); }
  };

  const deletePolicy = async (policy: TeamPolicy) => {
    if (!confirm(`Delete policy "${policy.name}"? Members using only this policy will lose all access.`)) return;
    try {
      await teamApi.deletePolicy(orgId, policy.id);
      toast.success("Policy deleted");
      await load(orgId);
    } catch { toast.error("Failed to delete policy"); }
  };

  return (
    <div className="p-8 md:p-12 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your organisation&apos;s members and access policies.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["members", "policies"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : activeTab === "members" ? (
        <div className="space-y-4">
          <div className="flex justify-end"><PrimaryButton onClick={() => setShowInvite(true)}>Invite User</PrimaryButton></div>
          <Table headers={["Name", "Email", "Policies", "Status", ""]}>
            {members.map(member => (
              <tr key={member.userId} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{member.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{member.policies.length ? member.policies.map(policy => policy.name).join(", ") : "—"}</td>
                <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${member.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>{member.status === "active" ? "Active" : "Invite Pending"}</span></td>
                <td className="px-4 py-3 text-right">{!member.isOrgOwner && member.userId !== currentUserId && <div className="flex justify-end gap-3"><button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditingMember(member)}>Edit Access</button><button className="text-xs text-destructive/70 hover:text-destructive" onClick={() => void removeMember(member)}>Remove</button></div>}</td>
              </tr>
            ))}
            {!members.length && <EmptyRow columns={5}>No members yet. Invite someone to get started.</EmptyRow>}
          </Table>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end"><PrimaryButton onClick={() => setShowCreate(true)}>New Policy</PrimaryButton></div>
          <Table headers={["Name", "Scopes", "Members", ""]}>
            {policies.map(policy => (
              <tr key={policy.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{policy.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{policy.scopes.length} scopes</td>
                <td className="px-4 py-3 text-muted-foreground">{policy.memberCount}</td>
                <td className="px-4 py-3"><div className="flex gap-3 justify-end"><button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditingPolicy(policy)}>Edit</button><button className="text-xs text-destructive/70 hover:text-destructive" onClick={() => void deletePolicy(policy)}>Delete</button></div></td>
              </tr>
            ))}
            {!policies.length && <EmptyRow columns={4}>No policies yet. Create one to start inviting members.</EmptyRow>}
          </Table>
        </div>
      )}

      {showInvite && <InviteModal orgId={orgId} platforms={org?.platformAccess ?? []} policies={policies} close={() => setShowInvite(false)} done={() => { setShowInvite(false); void load(orgId); }} />}
      {editingMember && <AccessModal orgId={orgId} member={editingMember} platforms={org?.platformAccess ?? []} policies={policies} close={() => setEditingMember(null)} done={() => { setEditingMember(null); void load(orgId); }} />}
      {(showCreate || editingPolicy) && <PolicyModal orgId={orgId} platforms={org?.platformAccess ?? []} policy={editingPolicy ?? undefined} close={() => { setShowCreate(false); setEditingPolicy(null); }} done={() => { setShowCreate(false); setEditingPolicy(null); void load(orgId); }} />}
    </div>
  );
}

function InviteModal({ orgId, platforms, policies, close, done }: { orgId: string; platforms: TeamOrg["platformAccess"]; policies: TeamPolicy[]; close: () => void; done: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [assignments, setAssignments] = useState<Partial<Record<TeamOrg["platformAccess"][number], string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await teamApi.invite(orgId, {
        email: email.trim(),
        name: name.trim(),
        assignments: platforms.flatMap(platform => assignments[platform] ? [{ platform, roleId: assignments[platform]! }] : []),
      });
      toast.success("Invitation sent");
      done();
    } catch { toast.error("Failed to invite user"); } finally { setSubmitting(false); }
  };
  return <Modal title="Invite User" close={close}><form onSubmit={submit} className="space-y-4">
    <Field label="Email"><input type="email" required autoFocus value={email} onChange={event => setEmail(event.target.value)} placeholder="colleague@company.com" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring" /></Field>
    <Field label="Full Name"><input required value={name} onChange={event => setName(event.target.value)} placeholder="Jane Smith" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring" /></Field>
    <AccessSelectors platforms={platforms} policies={policies} assignments={assignments} setAssignments={setAssignments} />
    <ModalActions close={close}><PrimaryButton disabled={submitting || !Object.values(assignments).some(Boolean)}>{submitting ? "Sending…" : "Send Invite"}</PrimaryButton></ModalActions>
  </form></Modal>;
}

function AccessModal({ orgId, member, platforms, policies, close, done }: { orgId: string; member: TeamMember; platforms: TeamOrg["platformAccess"]; policies: TeamPolicy[]; close: () => void; done: () => void }) {
  const [assignments, setAssignments] = useState<Partial<Record<TeamOrg["platformAccess"][number], string>>>(
    Object.fromEntries(member.policies.map(policy => [policy.platform, policy.id])),
  );
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await teamApi.replaceAccess(orgId, member.userId, platforms.flatMap(platform =>
        assignments[platform] ? [{ platform, roleId: assignments[platform]! }] : [],
      ));
      toast.success("Member access updated");
      done();
    } catch { toast.error("Failed to update member access"); } finally { setSubmitting(false); }
  };
  return <Modal title={`Edit Access — ${member.name}`} close={close}><form onSubmit={submit} className="space-y-4">
    <p className="text-sm text-muted-foreground">Choose one policy per platform. Select “No access” to remove access from that platform.</p>
    <AccessSelectors platforms={platforms} policies={policies} assignments={assignments} setAssignments={setAssignments} />
    <ModalActions close={close}><PrimaryButton disabled={submitting}>{submitting ? "Saving…" : "Save Changes"}</PrimaryButton></ModalActions>
  </form></Modal>;
}

function AccessSelectors({ platforms, policies, assignments, setAssignments }: {
  platforms: TeamOrg["platformAccess"];
  policies: TeamPolicy[];
  assignments: Partial<Record<TeamOrg["platformAccess"][number], string>>;
  setAssignments: React.Dispatch<React.SetStateAction<Partial<Record<TeamOrg["platformAccess"][number], string>>>>;
}) {
  return <div className="space-y-3">{platforms.map(platform => {
    const compatible = policies.filter(policy => policyPlatform(policy) === platform);
    return <Field key={platform} label={PLATFORM_LABELS[platform]}><select className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" value={assignments[platform] ?? ""} onChange={event => setAssignments(current => ({ ...current, [platform]: event.target.value }))}><option value="">No access</option>{compatible.map(policy => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></Field>;
  })}</div>;
}

function PolicyModal({ orgId, platforms, policy, close, done }: { orgId: string; platforms: TeamOrg["platformAccess"]; policy?: TeamPolicy; close: () => void; done: () => void }) {
  const [name, setName] = useState(policy?.name ?? "");
  const [scopes, setScopes] = useState<string[]>(policy?.scopes ?? []);
  const [platform, setPlatform] = useState<TeamOrg["platformAccess"][number] | "">(policy ? policyPlatform(policy) ?? "" : platforms[0] ?? "");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (policy) await teamApi.updatePolicy(orgId, policy.id, { name: name.trim(), scopes });
      else await teamApi.createPolicy(orgId, { name: name.trim(), scopes });
      toast.success(policy ? "Policy updated" : "Policy created");
      done();
    } catch { toast.error(policy ? "Failed to update policy" : "Failed to create policy"); } finally { setSubmitting(false); }
  };
  return <Modal title={policy ? "Edit Policy" : "New Policy"} close={close}><form onSubmit={submit} className="space-y-4">
    <Field label="Policy Name"><input required autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Project Manager" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-ring" /></Field>
    <Field label="Platform"><select disabled={!!policy} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60" value={platform} onChange={event => { setPlatform(event.target.value as TeamOrg["platformAccess"][number]); setScopes([]); }}>{platforms.map(item => <option key={item} value={item}>{PLATFORM_LABELS[item]}</option>)}</select></Field>
    {platform && <Field label="Scopes"><div className="max-h-72 overflow-y-auto rounded-lg border border-border p-3">{SCOPE_CATALOG[platform].map(item => <label key={item.scope} className="flex items-center gap-2.5 py-1 cursor-pointer"><input type="checkbox" checked={scopes.includes(item.scope)} onChange={() => setScopes(current => current.includes(item.scope) ? current.filter(scope => scope !== item.scope) : [...current, item.scope])} /><span className="text-sm">{item.label}</span><span className="text-xs text-muted-foreground ml-auto">{item.scope}</span></label>)}</div></Field>}
    <ModalActions close={close}><PrimaryButton disabled={submitting || !platform || !scopes.length}>{submitting ? "Saving…" : policy ? "Save Changes" : "Create Policy"}</PrimaryButton></ModalActions>
  </form></Modal>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border overflow-hidden"><table className="w-full text-sm"><thead className="bg-muted/40"><tr>{headers.map(header => <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">{header}</th>)}</tr></thead><tbody className="divide-y divide-border">{children}</tbody></table></div>;
}
function EmptyRow({ columns, children }: { columns: number; children: React.ReactNode }) { return <tr><td colSpan={columns} className="px-4 py-8 text-center text-muted-foreground text-sm">{children}</td></tr>; }
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={close}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-xl" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={close} className="text-muted-foreground hover:text-foreground" aria-label="Close">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><label className="text-sm font-medium">{label}</label>{children}</div>; }
function ModalActions({ close, children }: { close: () => void; children: React.ReactNode }) { return <div className="flex gap-2 justify-end pt-2"><button type="button" onClick={close} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Cancel</button>{children}</div>; }
function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{children}</button>; }
function Loading() { return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>; }
