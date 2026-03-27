import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Settings, LogOut, ExternalLink, Upload, Save, Loader2 } from 'lucide-react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { cn } from './lib/utils';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { PageContent, GlobalSettings } from './types';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Only throw if it's a critical error we want the ErrorBoundary to catch
  if (errInfo.error.includes('permission-denied') || errInfo.error.includes('Missing or insufficient permissions')) {
     throw new Error(JSON.stringify(errInfo));
  }
}

// --- Constants ---

const DEFAULT_PAGES: PageContent[] = [
  { pageId: '1', text: 'BmG studio', backgroundColor: '#000000', fontSize: '10vw', fontColor: '#FF007A' },
  { pageId: '2', text: 'We are a high-end minimalist creative studio focusing on digital experiences.', backgroundColor: '#000000', fontSize: '3rem', fontColor: '#FF007A' },
  { pageId: '3', text: 'Project Alpha', backgroundColor: '#000000', imageUrl: 'https://picsum.photos/seed/alpha/1200/800', linkUrl: 'https://drive.google.com/drive/folders/1GZJN9uvYpVpEq66oMl9aiAKMjo89vtd9?usp=sharing', fontSize: '2rem', fontColor: '#FF007A' },
  { pageId: '4', text: 'Project Beta', backgroundColor: '#000000', imageUrl: 'https://picsum.photos/seed/beta/1200/800', linkUrl: 'https://drive.google.com/drive/folders/17-rT1EsmqfZP2dczz6tk4TbQpj3YuuOw?usp=sharing', fontSize: '2rem', fontColor: '#FF007A' },
  { pageId: '5', text: 'Let\'s create something amazing.', backgroundColor: '#000000', linkText: 'Contact Us', linkUrl: 'mailto:hello@bmgstudio.com', fontSize: '4rem', fontColor: '#FF007A' },
];

const DEFAULT_SETTINGS: GlobalSettings = { logoText: 'BmG studio' };

// --- Components ---

const Cursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHoveringImage, setIsHoveringImage] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' || target.closest('.image-hover-target')) {
        setIsHoveringImage(true);
      } else {
        setIsHoveringImage(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  const Arrow = ({ opacity = 1, scale = 1 }: { opacity?: number, scale?: number }) => (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      style={{ opacity, transform: `scale(${scale}) rotate(-135deg)` }}
    >
      <path d="M3 3L21 12L3 21L7 12L3 3Z" stroke="#FF007A" strokeWidth="1" fill="#FF007A" fillOpacity="1" />
    </svg>
  );

  return (
    <>
      {/* Trail / Afterimage */}
      {[0.1, 0.2, 0.3].map((delay, i) => (
        <motion.div
          key={i}
          className="fixed top-0 left-0 pointer-events-none z-[9998]"
          animate={{ x: position.x, y: position.y }}
          transition={{ type: 'spring', damping: 30 + i * 10, stiffness: 200 - i * 40, mass: 0.5 }}
        >
          {!isHoveringImage && <Arrow opacity={0.4 - i * 0.1} scale={0.9 - i * 0.1} />}
        </motion.div>
      ))}

      {/* Main Cursor */}
      <motion.div
        className={cn(
          "fixed top-0 left-0 pointer-events-none z-[9999] flex items-center justify-center",
          isHoveringImage ? "w-12 h-12 bg-[#FF007A] rounded-full mix-blend-difference" : "w-6 h-6"
        )}
        animate={{
          x: position.x - (isHoveringImage ? 24 : 0),
          y: position.y - (isHoveringImage ? 24 : 0),
          scale: isHoveringImage ? 1.5 : 1,
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 400, mass: 0.1 }}
      >
        {!isHoveringImage && <Arrow />}
      </motion.div>
    </>
  );
};

const Navbar = ({ settings, user }: { settings: GlobalSettings, user: any }) => (
  <nav className="fixed top-0 left-0 w-full p-8 flex justify-between items-start z-50 pointer-events-none">
    <div className="pointer-events-auto">
      <Link to="/" className="block">
        {settings.logoImage ? (
          <img 
            src={settings.logoImage} 
            alt={settings.logoText || 'Logo'} 
            className="h-8 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="text-2xl font-bold tracking-tighter text-[#FF007A]">
            {settings.logoText || 'BmG studio'}
          </span>
        )}
      </Link>
    </div>
    <div className="flex gap-4 items-center pointer-events-auto">
      <Link 
        to="/admin" 
        className={cn(
          "p-2 bg-[#FF007A]/10 hover:bg-[#FF007A]/20 rounded-full transition-all",
          user ? "opacity-100" : "opacity-0 hover:opacity-100"
        )}
      >
        <Settings className="w-6 h-6 text-[#FF007A]" />
      </Link>
    </div>
  </nav>
);

const Page = ({ content, index, isActive }: any) => {
  const style: React.CSSProperties = {
    backgroundColor: content.backgroundColor || '#000000',
    color: content.fontColor || '#FF007A',
    fontFamily: content.fontFamily || 'inherit',
    fontSize: content.fontSize || 'inherit',
  };

  return (
    <div 
      className="min-w-full h-full flex flex-col items-center justify-center p-12 text-center"
      style={style}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="max-w-4xl"
      >
        {content.imageUrl && (
          <a 
            href={content.linkUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="image-hover-target block mb-8 overflow-hidden rounded-lg shadow-2xl"
          >
            <img 
              src={content.imageUrl} 
              alt={`Page ${content.pageId}`} 
              className="w-full h-auto max-h-[60vh] object-cover transition-transform duration-700 hover:scale-110"
              referrerPolicy="no-referrer"
            />
          </a>
        )}
        
        <h2 className="whitespace-pre-wrap leading-tight">
          {content.text}
        </h2>

        {content.pageId === '5' && content.linkUrl && (
          <a 
            href={content.linkUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 text-lg hover:underline opacity-80 hover:opacity-100 transition-all"
          >
            {content.linkText || 'Visit Link'} <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </motion.div>
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [pages, setPages] = useState<PageContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Load data
        const loadData = async () => {
          const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
          if (settingsDoc.exists()) setSettings(settingsDoc.data() as GlobalSettings);
          
          const pagesSnap = await getDocs(collection(db, 'pages'));
          const pagesData = pagesSnap.docs.map(d => d.data() as PageContent).sort((a, b) => parseInt(a.pageId) - parseInt(b.pageId));
          setPages(pagesData);
          setLoading(false);
        };
        loadData();
      } else {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings) {
        await setDoc(doc(db, 'settings', 'global'), settings);
      }
      for (const page of pages) {
        await setDoc(doc(db, 'pages', page.pageId), page);
      }
      alert('Settings saved successfully!');
    } catch (e) {
      console.error(e);
      alert('Error saving settings. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#FF007A]" /></div>;

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
        <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-white mb-6">Admin Access</h2>
          <button 
            onClick={handleLogin}
            className="w-full py-3 px-6 bg-[#FF007A] text-white rounded-lg font-semibold hover:bg-[#FF007A]/90 transition-colors flex items-center justify-center gap-2"
          >
            Login with Google
          </button>
          <button onClick={() => navigate('/')} className="mt-4 text-zinc-500 hover:text-white transition-colors">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-[100] overflow-y-auto p-4 md:p-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          <div className="flex gap-4">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-[#FF007A] text-white rounded-lg font-semibold hover:bg-[#FF007A]/90 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
            <button onClick={() => signOut(auth)} className="p-2 text-zinc-400 hover:text-white"><LogOut className="w-6 h-6" /></button>
            <button onClick={() => navigate('/')} className="p-2 text-zinc-400 hover:text-white text-2xl">×</button>
          </div>
        </div>

        <div className="space-y-12 pb-24">
          {/* Bootstrap Button */}
          {pages.length === 0 && (
            <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-500/30 flex items-center justify-between">
              <div>
                <h4 className="text-blue-400 font-semibold">Database Uninitialized</h4>
                <p className="text-sm text-blue-400/70">Click to populate the site with default content.</p>
              </div>
              <button 
                onClick={() => (window as any).bootstrapData()} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                Initialize Site
              </button>
            </div>
          )}

          {/* Global Settings */}
          <section className="bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800">
            <h3 className="text-xl font-semibold text-white mb-6">Global Settings</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Logo Text</label>
                <input 
                  type="text" 
                  value={settings?.logoText || ''} 
                  onChange={e => setSettings(s => s ? { ...s, logoText: e.target.value } : { logoText: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-[#FF007A]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Logo Image URL (Replaces Text)</label>
                <div className="flex gap-4">
                  <input 
                    type="text" 
                    placeholder="https://example.com/logo.png"
                    value={settings?.logoImage || ''} 
                    onChange={e => setSettings(s => s ? { ...s, logoImage: e.target.value } : { logoImage: e.target.value })}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-[#FF007A]"
                  />
                  {settings?.logoImage && (
                    <div className="w-12 h-12 bg-zinc-800 rounded-lg border border-zinc-700 p-1 flex items-center justify-center overflow-hidden">
                      <img src={settings.logoImage} alt="Preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Pages */}
          {pages.map((page, idx) => (
            <section key={page.pageId} className="bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800">
              <h3 className="text-xl font-semibold text-white mb-6">Page {page.pageId} Content</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Main Text</label>
                    <textarea 
                      value={page.text} 
                      onChange={e => {
                        const newPages = [...pages];
                        newPages[idx].text = e.target.value;
                        setPages(newPages);
                      }}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white h-32 focus:outline-none focus:border-[#FF007A]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Background Color</label>
                    <input 
                      type="color" 
                      value={page.backgroundColor} 
                      onChange={e => {
                        const newPages = [...pages];
                        newPages[idx].backgroundColor = e.target.value;
                        setPages(newPages);
                      }}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-lg p-1 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Font Color</label>
                    <input 
                      type="color" 
                      value={page.fontColor || '#FF007A'} 
                      onChange={e => {
                        const newPages = [...pages];
                        newPages[idx].fontColor = e.target.value;
                        setPages(newPages);
                      }}
                      className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-lg p-1 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Font Size (e.g., 5rem, 8vw)</label>
                    <input 
                      type="text" 
                      value={page.fontSize || ''} 
                      onChange={e => {
                        const newPages = [...pages];
                        newPages[idx].fontSize = e.target.value;
                        setPages(newPages);
                      }}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-[#FF007A]"
                    />
                  </div>
                  
                  {(page.pageId === '3' || page.pageId === '4') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Image URL</label>
                        <input 
                          type="text" 
                          value={page.imageUrl || ''} 
                          onChange={e => {
                            const newPages = [...pages];
                            newPages[idx].imageUrl = e.target.value;
                            setPages(newPages);
                          }}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-[#FF007A]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">External Link URL</label>
                        <input 
                          type="text" 
                          value={page.linkUrl || ''} 
                          onChange={e => {
                            const newPages = [...pages];
                            newPages[idx].linkUrl = e.target.value;
                            setPages(newPages);
                          }}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-[#FF007A]"
                        />
                      </div>
                    </>
                  )}

                  {page.pageId === '5' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Hyperlink Text</label>
                        <input 
                          type="text" 
                          value={page.linkText || ''} 
                          onChange={e => {
                            const newPages = [...pages];
                            newPages[idx].linkText = e.target.value;
                            setPages(newPages);
                          }}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-[#FF007A]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Hyperlink URL</label>
                        <input 
                          type="text" 
                          value={page.linkUrl || ''} 
                          onChange={e => {
                            const newPages = [...pages];
                            newPages[idx].linkUrl = e.target.value;
                            setPages(newPages);
                          }}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:outline-none focus:border-[#FF007A]"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);
  const [settings, setSettings] = useState<GlobalSettings>({ logoText: 'BmG studio' });
  const [pages, setPages] = useState<PageContent[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => setUser(u));
    
    // Listen for data changes
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as GlobalSettings);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    }, (error) => {
      console.warn("Settings snapshot error (likely uninitialized):", error.message);
      setSettings(DEFAULT_SETTINGS);
    });

    const unsubPages = onSnapshot(collection(db, 'pages'), (snap) => {
      const data = snap.docs.map(d => d.data() as PageContent).sort((a, b) => parseInt(a.pageId) - parseInt(b.pageId));
      if (data.length === 0) {
        setPages(DEFAULT_PAGES);
        setLoading(false);
      } else {
        setPages(data);
        setLoading(false);
      }
    }, (error) => {
      console.warn("Pages snapshot error (likely uninitialized):", error.message);
      setPages(DEFAULT_PAGES);
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubSettings();
      unsubPages();
    };
  }, []);

  const bootstrapData = async () => {
    if (!user || user.email !== 'hello.bmgstudio.official@gmail.com') {
      console.warn("Only the admin can bootstrap data.");
      return;
    }

    try {
      await setDoc(doc(db, 'settings', 'global'), DEFAULT_SETTINGS);
      for (const p of DEFAULT_PAGES) {
        await setDoc(doc(db, 'pages', p.pageId), p);
      }
      alert("Database initialized with default content.");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'bootstrap');
    }
  };

  useEffect(() => {
    (window as any).bootstrapData = bootstrapData;
  }, [user]);

  const nextPage = () => setCurrentPage(p => Math.min(p + 1, pages.length - 1));
  const prevPage = () => setCurrentPage(p => Math.max(0, p - 1));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextPage();
      if (e.key === 'ArrowLeft') prevPage();
      // Admin shortcut: Ctrl + Alt + A
      if (e.ctrlKey && e.altKey && e.key === 'a') {
        navigate('/admin');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pages.length]);

  if (loading && pages.length === 0) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#FF007A]" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-[#FF007A] selection:bg-[#FF007A] selection:text-black cursor-none">
      <Cursor />
      <Navbar settings={settings} user={user} />
      
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/" element={
          <>
            {/* Navigation Arrows */}
            <div className="fixed inset-y-0 left-0 w-24 flex items-center justify-center z-40 pointer-events-none">
              {currentPage > 0 && (
                <button 
                  onClick={prevPage}
                  className="p-4 pointer-events-auto hover:scale-125 transition-transform"
                >
                  <ChevronLeft className="w-12 h-12" />
                </button>
              )}
            </div>
            <div className="fixed inset-y-0 right-0 w-24 flex items-center justify-center z-40 pointer-events-none">
              {currentPage < pages.length - 1 && (
                <button 
                  onClick={nextPage}
                  className="p-4 pointer-events-auto hover:scale-125 transition-transform"
                >
                  <ChevronRight className="w-12 h-12" />
                </button>
              )}
            </div>

            {/* Horizontal Container */}
            <motion.div 
              ref={containerRef}
              className="flex h-full"
              animate={{ x: `-${currentPage * 100}%` }}
              transition={{ 
                duration: 1.4, 
                ease: [0.6, 0.01, -0.05, 0.95] // Custom smooth cubic bezier
              }}
            >
              {pages.map((page, i) => (
                <div key={page.pageId} className="min-w-full h-full">
                  <Page content={page} index={i} isActive={currentPage === i} />
                </div>
              ))}
            </motion.div>

            {/* Page Indicator */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-40">
              {pages.map((_, i) => (
                <div 
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-500",
                    currentPage === i ? "bg-[#FF007A] w-8" : "bg-[#FF007A]/20"
                  )}
                />
              ))}
            </div>
          </>
        } />
      </Routes>
    </div>
  );
}
