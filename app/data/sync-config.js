/* Configuration de la synchronisation multi-appareils (Supabase).
   La clé « anon » est publique par conception (elle n'ouvre que ce que les
   policies RLS autorisent : ici la table progress, protégée par
   l'imprévisibilité du hash du code de synchro). Voir docs/SYNC.md. */
window.SYNC_CONFIG = {
  url: "https://kstqtbvnzaipocutevlw.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzdHF0YnZuemFpcG9jdXRldmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjkxNDcsImV4cCI6MjEwMDQwNTE0N30.JpbxrrFIQY7Lv8Pdl-R8M_2_kTab_BQ3zG1uS1pZexg",
};
