useEffect(() => {
    let authSubscription;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('UPDATE_PASSWORD'); 
      } else if (event === 'SIGNED_IN' && view === 'LOGIN' && session) {
        redirectUser(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        // CORRECCIÓN VITAL: Redirigir a login y resetear el componente
        setView('LOGIN');
        navigate('/');
      }
    });

    if (data && data.subscription) authSubscription = data.subscription;
    return () => { if (authSubscription) authSubscription.unsubscribe(); };
  }, [view, navigate]);