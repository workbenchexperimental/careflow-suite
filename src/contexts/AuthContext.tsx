import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, TherapistProfile, AdminProfile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: TherapistProfile | AdminProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isTherapist: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<TherapistProfile | AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRoleAndProfile = async (userId: string) => {
    try {
      // Obtener rol del usuario
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        return;
      }

      if (!roleData) {
        console.log('No role found for user');
        setRole(null);
        setProfile(null);
        return;
      }

      const userRole = roleData.role as AppRole;
      setRole(userRole);

      // Obtener perfil según el rol
      if (userRole === 'admin') {
        const { data: adminData, error: adminError } = await supabase
          .from('admin_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (adminError) {
          console.error('Error fetching admin profile:', adminError);
          return;
        }

        setProfile(adminData as AdminProfile);

        // Actualizar last_login
        await supabase
          .from('admin_profiles')
          .update({ last_login: new Date().toISOString() })
          .eq('user_id', userId);

      } else if (userRole === 'terapeuta') {
        const { data: therapistData, error: therapistError } = await supabase
          .from('therapist_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (therapistError) {
          console.error('Error fetching therapist profile:', therapistError);
          return;
        }

        setProfile(therapistData as TherapistProfile);

        // Actualizar last_login
        await supabase
          .from('therapist_profiles')
          .update({ last_login: new Date().toISOString() })
          .eq('user_id', userId);
      }

      // Registrar acceso
      await supabase.from('access_logs').insert({
        user_id: userId,
        action: 'login',
      });

    } catch (error) {
      console.error('Error in fetchUserRoleAndProfile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserRoleAndProfile(user.id);
    }
  };

  useEffect(() => {
    // Configurar listener de cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Usar setTimeout para evitar deadlock
          setTimeout(() => {
            fetchUserRoleAndProfile(currentSession.user.id);
          }, 0);
        } else {
          setRole(null);
          setProfile(null);
        }
      }
    );

    // Verificar sesión existente
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        fetchUserRoleAndProfile(existingSession.user.id).finally(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signOut = async () => {
    if (user) {
      // Registrar cierre de sesión
      await supabase.from('access_logs').insert({
        user_id: user.id,
        action: 'logout',
      });
    }

    await supabase.auth.signOut();
    setRole(null);
    setProfile(null);
  };

  const value: AuthContextType = {
    user,
    session,
    role,
    profile,
    isLoading,
    isAdmin: role === 'admin',
    isTherapist: role === 'terapeuta',
    signIn,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}