"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  allowed_wards: string;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Form State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [formWards, setFormWards] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // App Settings
  const [syncToCloud, setSyncToCloud] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin");
    } else if (status === "authenticated") {
      const isAdmin = (session.user as any).role === "admin" || session.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      if (!isAdmin) {
        router.push("/");
      } else {
        fetchUsers();
      }
    }
  }, [status, session, router]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openDrawerForNew = () => {
    setEditingUserId(null);
    setFormName("");
    setFormEmail("");
    setFormRole("user");
    setFormWards("");
    setIsDrawerOpen(true);
  };

  const openDrawerForEdit = (user: User) => {
    setEditingUserId(user.id);
    setFormName(user.name || "");
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormWards(user.allowed_wards || "");
    setIsDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    
    try {
      // POST for new, PUT for edit
      const method = editingUserId ? "PUT" : "POST";
      const payload = {
        id: editingUserId,
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        role: formRole,
        allowed_wards: formWards.trim(),
        syncToNeon: syncToCloud
      };
      
      const res = await fetch("/api/admin/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to save user");
      
      if (data.neonFailed) {
        setError(data.message);
      } else {
        setSuccess("User saved successfully!");
        setIsDrawerOpen(false);
      }
      
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectUser = (id: number) => {
    setSelectedUsers(prev => 
      prev.includes(id) ? prev.filter(uId => uId !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  };

  const handleSendWelcomeEmail = async () => {
    if (selectedUsers.length === 0) {
      alert("Please select at least one user to email.");
      return;
    }
    
    if (!confirm(`Are you sure you want to send welcome emails to ${selectedUsers.length} users?`)) return;
    
    setError("");
    setSuccess("Sending emails...");
    
    let successCount = 0;
    
    for (const id of selectedUsers) {
      const user = users.find(u => u.id === id);
      if (!user) continue;
      
      try {
        const res = await fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, name: user.name }),
        });
        if (res.ok) successCount++;
      } catch (e) {
        console.error("Failed to email", user.email);
      }
    }
    
    setSuccess(`Successfully sent ${successCount} emails!`);
    setSelectedUsers([]);
  };

  if (loading) return <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col md:flex-row">
      
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 p-6 hidden md:block shadow-sm">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xl">
            AV
          </div>
          <div>
            <h1 className="font-bold text-indigo-900 text-xl tracking-tight">AuthVault</h1>
            <p className="text-xs text-slate-500 font-medium">Enterprise Admin</p>
          </div>
        </div>
        <ul className="space-y-2">
          <li>
            <a href="#" className="flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-lg font-semibold border-l-4 border-indigo-600 shadow-sm transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              Auth Users
            </a>
          </li>
        </ul>
        <div className="mt-auto pt-10">
           <button onClick={() => signOut({ callbackUrl: '/login' })} className="flex items-center gap-2 text-slate-500 hover:text-red-600 px-4 py-2 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sign Out
           </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Authentication Management</h2>
            <p className="text-slate-500 mt-1">Manage application user identities, roles, and access controls.</p>
          </div>
          <div className="flex gap-3">
             {selectedUsers.length > 0 && (
                <button onClick={handleSendWelcomeEmail} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-5 rounded-lg shadow-sm shadow-indigo-200 transition-all active:scale-95 font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Send Welcome Email ({selectedUsers.length})
                </button>
             )}
             <button onClick={openDrawerForNew} className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 px-5 rounded-lg shadow-sm transition-all active:scale-95 font-medium">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
               Add User
             </button>
          </div>
        </header>

        {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-start gap-3 shadow-sm">
               <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               <div>{error}</div>
            </div>
        )}
        
        {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-start gap-3 shadow-sm">
               <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <div>{success}</div>
            </div>
        )}

        {/* Sync Feature Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
             <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
             </div>
             <div>
                <h3 className="text-lg font-semibold text-slate-900">Cloud Backup Synchronization</h3>
                <p className="text-sm text-slate-500 mt-1">Automatically push auth user delta changes to the secure Neon cloud vault.</p>
             </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none group">
             <input type="checkbox" checked={syncToCloud} onChange={(e) => setSyncToCloud(e.target.checked)} className="sr-only peer" />
             <div className={`w-14 h-7 rounded-full transition-colors relative ${syncToCloud ? 'bg-[#00F5FF]' : 'bg-slate-300'}`} style={syncToCloud ? { boxShadow: '0 0 10px #00F5FF, 0 0 20px #00F5FF, inset 0 0 5px #00F5FF', borderColor: '#00F5FF' } : {}}>
                <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-6 w-6 transition-transform shadow-md ${syncToCloud ? 'translate-x-7' : 'translate-x-0'}`}></div>
             </div>
             <span className="ml-3 text-sm font-semibold text-slate-700">Neon Sync</span>
          </label>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
               <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                     <th className="py-4 px-6 text-center w-12">
                       <input type="checkbox" checked={users.length > 0 && selectedUsers.length === users.length} onChange={selectAll} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                     </th>
                     <th className="py-4 px-6">User details</th>
                     <th className="py-4 px-6">Access Role</th>
                     <th className="py-4 px-6">Ward Coverage</th>
                     <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {users.map(user => (
                     <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 text-center">
                           <input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => toggleSelectUser(user.id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                        </td>
                        <td className="py-4 px-6">
                           <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                 {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                 <div className="font-semibold text-slate-900">{user.name || 'No Name Provided'}</div>
                                 <div className="text-sm text-slate-500">{user.email}</div>
                              </div>
                           </div>
                        </td>
                        <td className="py-4 px-6">
                           <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                              user.role === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                              'bg-slate-100 text-slate-600 border-slate-200'
                           }`}>
                              {user.role.toUpperCase()}
                           </span>
                        </td>
                        <td className="py-4 px-6 text-slate-600 text-sm font-medium">
                           {user.allowed_wards || 'All Wards'}
                        </td>
                        <td className="py-4 px-6 text-right">
                           <button onClick={() => openDrawerForEdit(user)} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors">
                              Edit Access
                           </button>
                        </td>
                     </tr>
                  ))}
                  {users.length === 0 && (
                     <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">No users found.</td>
                     </tr>
                  )}
               </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Side Panel Form (Drawer) */}
      {isDrawerOpen && (
         <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
            
            <div className="w-full max-w-md bg-white h-full shadow-2xl relative transform transition-transform border-l border-slate-200 flex flex-col animate-slide-in-right">
               <div className="flex items-center justify-between p-6 border-b border-slate-100">
                  <h3 className="text-xl font-bold text-slate-900">{editingUserId ? 'Edit App User' : 'Add App User'}</h3>
                  <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
               </div>
               
               <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                  <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                     <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="John Doe" />
                  </div>
                  
                  <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address *</label>
                     <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="user@example.com" disabled={!!editingUserId} />
                     {!!editingUserId && <p className="text-xs text-slate-400 mt-1">Email cannot be changed once set.</p>}
                  </div>
                  
                  <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1.5">Access Role</label>
                     <select value={formRole} onChange={e => setFormRole(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="user">User (Guest)</option>
                        <option value="paid">Paid Customer</option>
                        <option value="admin">Administrator</option>
                     </select>
                  </div>
                  
                  <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-1.5">Allowed Wards</label>
                     <input type="text" value={formWards} onChange={e => setFormWards(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. 5,10,31 or 'all'" />
                     <p className="text-xs text-slate-500 mt-1.5">Leave blank or type 'all' for unlimited access.</p>
                  </div>
               </form>
               
               <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                  <button onClick={() => setIsDrawerOpen(false)} type="button" className="flex-1 bg-white border border-slate-300 text-slate-700 py-2.5 rounded-lg font-medium shadow-sm hover:bg-slate-50 transition-colors">
                     Cancel
                  </button>
                  <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-50">
                     {isSubmitting ? 'Saving...' : 'Save User'}
                  </button>
               </div>
            </div>
         </div>
      )}

      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
