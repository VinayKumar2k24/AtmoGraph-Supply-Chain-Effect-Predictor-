import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  ArrowRight, Globe, Share2, Zap, BarChart2,
  Eye, Target, TrendingUp, Lightbulb, Play, Send,
  Plane, Anchor, Factory, Truck, ShoppingBag, Building2,
  ShieldCheck, Lock, KeyRound, FileCheck, Server, Layers,
  Check, Activity, Database, Terminal, Radio, Cpu, Menu, X,
  ChevronRight, Sparkles, ExternalLink, AlertCircle, Users
} from 'lucide-react';
import './LandingPage.css';

// Generated photorealistic visual assets
import heroShipImg from '../assets/hero_ship.jpg';
import solSignalsImg from '../assets/solution_signals.jpg';
import solGlobeImg from '../assets/solution_globe.jpg';
import solPredictImg from '../assets/solution_predict.jpg';
import solActionImg from '../assets/solution_action.jpg';
import ctaHighwayImg from '../assets/cta_highway.jpg';

/* ── Custom Constellation Logo Icon ── */
function BrandLogo({ size = 32 }) {
  return (
    <div className="lp-logo-box" style={{ width: size, height: size }}>
      <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="3" fill="#00e5ff" />
        <circle cx="5" cy="7" r="2" fill="#38bdf8" />
        <circle cx="19" cy="7" r="2" fill="#38bdf8" />
        <circle cx="6" cy="17" r="2" fill="#00e5ff" />
        <circle cx="18" cy="17" r="2" fill="#00e5ff" />
        <line x1="5" y1="7" x2="12" y2="12" stroke="#00e5ff" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="19" y1="7" x2="12" y2="12" stroke="#00e5ff" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="6" y1="17" x2="12" y2="12" stroke="#00e5ff" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="18" y1="17" x2="12" y2="12" stroke="#00e5ff" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="5" y1="7" x2="6" y2="17" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 2" />
        <line x1="19" y1="7" x2="18" y2="17" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 2" />
      </svg>
    </div>
  );
}

/* ── Animated Counter Hook ── */
function CountUp({ end, suffix = '' }) {
  const [val, setVal] = useState(end);
  const ref = useRef(null);

  useEffect(() => {
    let fired = false;
    const startAnim = () => {
      if (fired) return;
      fired = true;
      let v = 0;
      const step = Math.max(1, Math.ceil(end / 25));
      const t = setInterval(() => {
        v += step;
        if (v >= end) {
          setVal(end);
          clearInterval(t);
        } else {
          setVal(v);
        }
      }, 25);
    };

    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        obs.disconnect();
        startAnim();
      }
    }, { threshold: 0.05 });

    if (ref.current) obs.observe(ref.current);
    // Fallback timer to trigger animation if already visible
    const timer = setTimeout(startAnim, 400);

    return () => {
      obs.disconnect();
      clearTimeout(timer);
    };
  }, [end]);

  return <span ref={ref}>{val}{suffix}</span>;
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'overview' | 'demo' | 'how-it-works' | 'live-scenario' | 'about' | 'security'
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null);

  // Scroll detection for sticky navbar blur effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 25);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (activeModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeModal]);

  const handleNavClick = (e, item) => {
    if (item.action) {
      e.preventDefault();
      item.action();
      setMenu(false);
    }
  };

  const navItems = [
    { label: 'Home', href: '#home', active: true },
    {
      label: 'Platform',
      href: isAuthenticated ? '/dashboard' : '#solution',
      action: () => {
        const el = document.getElementById('solution');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      label: 'How It Works',
      href: '#how-it-works',
      action: () => setActiveModal('how-it-works')
    },
    {
      label: 'Live Scenario',
      href: '#live-scenario',
      action: () => setActiveModal('live-scenario')
    },
    {
      label: 'About',
      href: '#about',
      action: () => setActiveModal('about')
    },
    {
      label: 'Security',
      href: '#security',
      action: () => setActiveModal('security')
    },
  ];

  const handleNewsletter = (e) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes('@')) {
      setNewsletterStatus('error');
      return;
    }
    setNewsletterStatus('success');
    setNewsletterEmail('');
    setTimeout(() => setNewsletterStatus(null), 4000);
  };

  return (
    <div className="lp">

      {/* ══════════════════════════════════════════════════════════════
          1. HEADER / NAVIGATION SECTION
          ══════════════════════════════════════════════════════════════ */}
      <header className={`lp-nav${scrolled ? ' lp-nav--scrolled' : ''}`}>
        <Link to="/" className="lp-nav-brand">
          <BrandLogo size={36} />
          <div className="lp-brand-words">
            <span className="lp-brand-name">AtmoGraph</span>
            <span className="lp-brand-sub">SUPPLY CHAIN INTELLIGENCE</span>
          </div>
        </Link>

        <ul className="lp-nav-links">
          {navItems.map((n) => (
            <li key={n.label}>
              <a
                href={n.href}
                onClick={(e) => handleNavClick(e, n)}
                className={`lp-nav-link${n.active ? ' lp-nav-link--active' : ''}`}
              >
                {n.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="lp-nav-actions">
          {isAuthenticated ? (
            <Link to="/dashboard" className="lp-cta-btn">
              Dashboard <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="lp-ghost-btn">
                Sign In
              </Link>
              <Link to="/signup" className="lp-cta-btn">
                Get Started <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu trigger */}
        <button
          className="lp-burger"
          onClick={() => setMenu((o) => !o)}
          aria-label="Toggle Menu"
        >
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {menu && (
        <div className="lp-mobile-menu">
          {navItems.map((n) => (
            <a
              key={n.label}
              href={n.href}
              className={`lp-mobile-link${n.active ? ' lp-mobile-link--active' : ''}`}
              onClick={(e) => handleNavClick(e, n)}
            >
              {n.label}
            </a>
          ))}
          <div className="lp-mobile-actions">
            {isAuthenticated ? (
              <Link to="/dashboard" className="lp-cta-btn" onClick={() => setMenu(false)}>
                Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="lp-ghost-btn" onClick={() => setMenu(false)}>
                  Sign In
                </Link>
                <Link to="/signup" className="lp-cta-btn" onClick={() => setMenu(false)}>
                  Get Started <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          2. HERO SECTION (MAIN BANNER)
          ══════════════════════════════════════════════════════════════ */}
      <section id="home" className="lp-hero">
        {/* Left Column: Headline, Copy, Action CTAs & Trust Badges */}
        <div className="lp-hero-left">
          <div className="lp-pill">
            <span className="lp-pulse-dot" />
            <span className="lp-pill-text">AI-POWERED SUPPLY CHAIN INTELLIGENCE</span>
          </div>

          <h1 className="lp-hero-h1">
            <span className="lp-h1-white">Predict Global</span>
            <span className="lp-h1-white">Supply Chain Shocks</span>
            <span className="lp-h1-cyan">Before They Cascade.</span>
          </h1>

          <p className="lp-hero-desc">
            AtmoGraph turns real-world events into actionable intelligence
            using real-time news, AI, and graph neural networks — helping
            organizations anticipate disruptions and stay resilient.
          </p>

          <div className="lp-hero-ctas">
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="lp-cta-btn lp-cta-btn--lg"
            >
              Explore the Platform <ArrowRight size={16} />
            </Link>
            <button
              onClick={() => setActiveModal('overview')}
              className="lp-outline-btn lp-outline-btn--lg"
            >
              <span className="lp-play-ring">
                <Play size={11} fill="#fff" />
              </span>
              Watch Overview
            </button>
          </div>

          <div className="lp-hero-trust">
            <div className="lp-trust-item">
              <span className="lp-trust-ring" />
              <span>Real-time intelligence</span>
            </div>
            <div className="lp-trust-item">
              <span className="lp-trust-ring" />
              <span>Graph-powered insights</span>
            </div>
            <div className="lp-trust-item">
              <span className="lp-trust-ring" />
              <span>Predictive decision support</span>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Visual with Night Cargo Ship, Live Card, Watermark */}
        <div className="lp-hero-right">
          <div className="lp-hero-caption">
            A more resilient<br />
            <strong>supply chain starts</strong><br />
            with intelligence.
          </div>

          <div className="lp-hero-img-shell">
            <img
              src={heroShipImg}
              alt="Autonomous Container Port at Night"
              className="lp-hero-img"
              loading="eager"
            />
            {/* Ambient gradients for cinematic blending */}
            <div className="lp-hero-grad-left" />
            <div className="lp-hero-grad-bottom" />
            <div className="lp-hero-grad-top" />

            {/* Floating Live Event Card */}
            <div
              className="lp-live-card"
              onClick={() => setActiveModal('live-scenario')}
              title="Click to view live simulation"
            >
              <div className="lp-live-header">
                <span className="lp-live-dot" />
                <span className="lp-live-label">LIVE EVENT</span>
                <ChevronRight size={13} className="lp-live-arrow" />
              </div>
              <p className="lp-live-title">Port Disruption Detected</p>
              <p className="lp-live-loc">Chennai Port, India</p>
              <p className="lp-live-sub">Potential delay in shipments</p>
              <div className="lp-live-footer">
                <div className="lp-live-bars">
                  {[8, 14, 22, 12, 19, 9, 17, 11].map((h, i) => (
                    <span
                      key={i}
                      className="lp-live-bar"
                      style={{ height: `${h}px`, animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
                <ChevronRight size={14} color="#00e5ff" />
              </div>
            </div>

            {/* Bottom-right cursive watermark script */}
            <div className="lp-hero-corner">
              <span>From</span>
              <span>Global Events</span>
              <span>to Safer Supply Chains</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          3. KEY METRICS / STATS SECTION
          ══════════════════════════════════════════════════════════════ */}
      <section className="lp-stats-wrap">
        <div className="lp-stats-bar">
          <div className="lp-stat-cell">
            <div className="lp-stat-icon-wrap">
              <Globe size={26} color="#00e5ff" />
            </div>
            <div className="lp-stat-body">
              <span className="lp-stat-num">
                <CountUp end={18} suffix="+" />
              </span>
              <span className="lp-stat-label">Supply Chain Nodes</span>
            </div>
          </div>

          <div className="lp-stat-sep" />

          <div className="lp-stat-cell">
            <div className="lp-stat-icon-wrap">
              <Share2 size={26} color="#00e5ff" />
            </div>
            <div className="lp-stat-body">
              <span className="lp-stat-num">
                <CountUp end={24} suffix="" />
              </span>
              <span className="lp-stat-label">Graph Relationships</span>
            </div>
          </div>

          <div className="lp-stat-sep" />

          <div className="lp-stat-cell">
            <div className="lp-stat-icon-wrap">
              <Zap size={26} color="#00e5ff" />
            </div>
            <div className="lp-stat-body">
              <span className="lp-stat-num">Real-Time</span>
              <span className="lp-stat-label">News Intelligence</span>
            </div>
          </div>

          <div className="lp-stat-sep" />

          <div className="lp-stat-cell">
            <div className="lp-stat-icon-wrap">
              <BarChart2 size={26} color="#00e5ff" />
            </div>
            <div className="lp-stat-body">
              <span className="lp-stat-num">30/60/90</span>
              <span className="lp-stat-label">Day Predictive Horizon</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          4. SOLUTION FEATURES SECTION
          ══════════════════════════════════════════════════════════════ */}
      <section id="solution" className="lp-section">
        <div className="lp-section-head">
          <span className="lp-eyebrow-pill">OUR SOLUTION</span>
          <h2 className="lp-h2">Intelligence for a More Resilient Tomorrow</h2>
          <p className="lp-sub">
            AtmoGraph helps you see the bigger picture, detect risks early, and make data-driven decisions.
          </p>
        </div>

        <div className="lp-sol-grid">
          {/* Card 1: See Early Signals */}
          <div className="lp-sol-card">
            <div className="lp-sol-top">
              <div className="lp-sol-icon">
                <Radio size={19} />
              </div>
              <h3 className="lp-sol-title">See Early Signals</h3>
              <p className="lp-sol-desc">
                Turn global news into meaningful supply chain intelligence.
              </p>
            </div>
            <div className="lp-sol-img-wrap">
              <img
                src={solSignalsImg}
                alt="Satellite Station News Signals"
                className="lp-sol-img"
                loading="lazy"
              />
              <div className="lp-sol-img-grad" />
            </div>
          </div>

          {/* Card 2: Understand Impact */}
          <div className="lp-sol-card">
            <div className="lp-sol-top">
              <div className="lp-sol-icon">
                <ShieldCheck size={19} />
              </div>
              <h3 className="lp-sol-title">Understand Impact</h3>
              <p className="lp-sol-desc">
                Map complex supplier relationships and identify vulnerabilities.
              </p>
            </div>
            <div className="lp-sol-img-wrap">
              <img
                src={solGlobeImg}
                alt="Digital Connected Globe Network"
                className="lp-sol-img"
                loading="lazy"
              />
              <div className="lp-sol-img-grad" />
            </div>
          </div>

          {/* Card 3: Predict What's Next */}
          <div className="lp-sol-card">
            <div className="lp-sol-top">
              <div className="lp-sol-icon">
                <Target size={19} />
              </div>
              <h3 className="lp-sol-title">Predict What's Next</h3>
              <p className="lp-sol-desc">
                Estimate delays and propagation effects using Graph AI.
              </p>
            </div>
            <div className="lp-sol-img-wrap">
              <img
                src={solPredictImg}
                alt="Cargo Shipping Container Yard Predictive Analytics"
                className="lp-sol-img"
                loading="lazy"
              />
              <div className="lp-sol-img-grad" />
            </div>
          </div>

          {/* Card 4: Take Action */}
          <div className="lp-sol-card">
            <div className="lp-sol-top">
              <div className="lp-sol-icon">
                <Users size={19} />
              </div>
              <h3 className="lp-sol-title">Take Action</h3>
              <p className="lp-sol-desc">
                Empower decision-makers with clear, actionable insights.
              </p>
            </div>
            <div className="lp-sol-img-wrap">
              <img
                src={solActionImg}
                alt="Logistics Trucks Terminal"
                className="lp-sol-img"
                loading="lazy"
              />
              <div className="lp-sol-img-grad" />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          5. CASE STUDY / CTA SECTION
          ══════════════════════════════════════════════════════════════ */}
      <section className="lp-cta-wrapper">
        <div className="lp-cta-card">
          <div className="lp-cta-bg">
            <img
              src={ctaHighwayImg}
              alt="Global Highway Viaduct Connectivity"
              className="lp-cta-bgimg"
              loading="lazy"
            />
            <div className="lp-cta-overlay" />
          </div>

          <div className="lp-cta-content">
            <div className="lp-cta-left">
              <span className="lp-cta-eyebrow">
                GLOBAL CONNECTIVITY. STRONGER SUPPLY CHAINS.
              </span>
              <h2 className="lp-cta-h2">
                Turn Uncertainty<br />
                Into Opportunity
              </h2>
              <p className="lp-cta-desc">
                In a world of constant change, AtmoGraph gives you the intelligence to stay ahead,
                adapt faster, and build a stronger, more resilient supply chain.
              </p>
              <div className="lp-cta-btns">
                <Link to="/signup" className="lp-cta-btn lp-cta-btn--lg">
                  Get Started <ArrowRight size={16} />
                </Link>
                <button
                  onClick={() => setActiveModal('demo')}
                  className="lp-outline-btn lp-outline-btn--lg"
                >
                  <span className="lp-play-ring">
                    <Play size={11} fill="#fff" />
                  </span>
                  Watch Demo
                </button>
              </div>
            </div>

            <div className="lp-cta-right">
              <div className="lp-quote-card">
                <span className="lp-quote-mark">&ldquo;</span>
                <p className="lp-quote-text">
                  Disruptions don't wait.<br />
                  Neither should your decisions.
                </p>
                <div className="lp-quote-dash" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          6. INDUSTRY ICONS SECTION
          ══════════════════════════════════════════════════════════════ */}
      <section className="lp-industry-bar">
        <div className="lp-industry-inner">
          <div className="lp-industry-item">
            <Plane size={20} className="lp-ind-icon" />
            <span>Aviation</span>
          </div>
          <div className="lp-industry-item">
            <Anchor size={20} className="lp-ind-icon" />
            <span>Ports & Maritime</span>
          </div>
          <div className="lp-industry-item">
            <Factory size={20} className="lp-ind-icon" />
            <span>Manufacturing</span>
          </div>
          <div className="lp-industry-item">
            <Truck size={20} className="lp-ind-icon" />
            <span>Logistics</span>
          </div>
          <div className="lp-industry-item">
            <ShoppingBag size={20} className="lp-ind-icon" />
            <span>Retail</span>
          </div>
          <div className="lp-industry-item">
            <Building2 size={20} className="lp-ind-icon" />
            <span>Distribution</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          7. FOOTER SECTION
          ══════════════════════════════════════════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          {/* Brand Column */}
          <div className="lp-footer-brand">
            <div className="lp-footer-brand-row">
              <BrandLogo size={32} />
              <div>
                <p className="lp-footer-name">AtmoGraph</p>
                <p className="lp-footer-sub">SUPPLY CHAIN INTELLIGENCE</p>
              </div>
            </div>
            <p className="lp-footer-tagline">
              Transforming global events into predictive intelligence for a more resilient tomorrow.
            </p>
          </div>

          {/* Product Column */}
          <div className="lp-footer-col">
            <h5 className="lp-footer-col-hd">Product</h5>
            <a
              href="#solution"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('solution')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="lp-footer-link"
            >
              Platform
            </a>
            <button
              onClick={() => setActiveModal('how-it-works')}
              className="lp-footer-link-btn"
            >
              How It Works
            </button>
            <button
              onClick={() => setActiveModal('live-scenario')}
              className="lp-footer-link-btn"
            >
              Live Scenario
            </button>
            <button
              onClick={() => setActiveModal('about')}
              className="lp-footer-link-btn"
            >
              About
            </button>
            <button
              onClick={() => setActiveModal('security')}
              className="lp-footer-link-btn"
            >
              Security
            </button>
          </div>

          {/* Account Column */}
          <div className="lp-footer-col">
            <h5 className="lp-footer-col-hd">Account</h5>
            <Link to="/login" className="lp-footer-link">
              Sign In
            </Link>
            <Link to="/signup" className="lp-footer-link">
              Get Started
            </Link>
            {isAuthenticated && (
              <Link to="/dashboard" className="lp-footer-link">
                Dashboard
              </Link>
            )}
          </div>

          {/* Stay Updated Column */}
          <div className="lp-footer-col lp-footer-col--nl">
            <h5 className="lp-footer-col-hd">Stay Updated</h5>
            <p className="lp-footer-nl-desc">Get the latest updates and insights.</p>
            <form onSubmit={handleNewsletter} className="lp-footer-nl-form">
              <input
                type="email"
                placeholder="Enter your email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                className="lp-footer-nl-input"
                aria-label="Email address"
              />
              <button type="submit" className="lp-footer-nl-btn" aria-label="Subscribe">
                <ArrowRight size={16} />
              </button>
            </form>
            {newsletterStatus === 'success' && (
              <span className="lp-nl-msg lp-nl-msg--ok">✓ Thank you for subscribing!</span>
            )}
            {newsletterStatus === 'error' && (
              <span className="lp-nl-msg lp-nl-msg--err">Please enter a valid email address.</span>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="lp-footer-bottom">
          <span>&copy; 2026 AtmoGraph. All rights reserved.</span>
          <span className="lp-footer-slogan">Predict &nbsp;&middot;&nbsp; Prepare &nbsp;&middot;&nbsp; Stay Resilient</span>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════════════
          INTERACTIVE MODALS
          ══════════════════════════════════════════════════════════════ */}
      {activeModal && (
        <div className="lp-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div
            className="lp-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              className="lp-modal-close"
              onClick={() => setActiveModal(null)}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            {/* Modal: Overview / Walkthrough */}
            {activeModal === 'overview' && (
              <div className="lp-modal-content">
                <div className="lp-modal-header">
                  <div className="lp-pill">
                    <Sparkles size={13} color="#00e5ff" />
                    <span>PLATFORM WALKTHROUGH</span>
                  </div>
                  <h3 className="lp-modal-title">AtmoGraph Architecture Overview</h3>
                  <p className="lp-modal-subtitle">
                    Autonomous pipeline connecting real-time intelligence feeds with Graph Neural Network shockwave modeling.
                  </p>
                </div>

                <div className="lp-modal-grid">
                  <div className="lp-modal-feature">
                    <div className="lp-modal-feat-icon"><Radio size={20} color="#00e5ff" /></div>
                    <h4>1. Continuous Ingestion</h4>
                    <p>Background workers harvest global news and maritime feeds continuously, analyzing disruption signals.</p>
                  </div>
                  <div className="lp-modal-feature">
                    <div className="lp-modal-feat-icon"><Terminal size={20} color="#38bdf8" /></div>
                    <h4>2. Precision NLP Extraction</h4>
                    <p>Custom entity linking maps corporate entities, ports, and transit corridors while filtering publisher noise.</p>
                  </div>
                  <div className="lp-modal-feature">
                    <div className="lp-modal-feat-icon"><Database size={20} color="#818cf8" /></div>
                    <h4>3. Knowledge Graph Sync</h4>
                    <p>Neo4j graph database captures multi-tier supplier links, route dependencies, and transit nodes in real time.</p>
                  </div>
                  <div className="lp-modal-feature">
                    <div className="lp-modal-feat-icon"><Cpu size={20} color="#00e5ff" /></div>
                    <h4>4. GNN Shockwave Modeling</h4>
                    <p>GraphSAGE neural networks propagate shock waves across edges to calculate multi-tier vulnerability indices.</p>
                  </div>
                </div>

                <div className="lp-modal-footer">
                  <Link to={isAuthenticated ? '/dashboard' : '/signup'} className="lp-cta-btn">
                    Launch Interactive Platform <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}

            {/* Modal: Live Demo / Chennai Scenario */}
            {(activeModal === 'demo' || activeModal === 'live-scenario') && (
              <div className="lp-modal-content">
                <div className="lp-modal-header">
                  <div className="lp-pill">
                    <span className="lp-live-dot" />
                    <span>INTERACTIVE DISRUPTION SCENARIO</span>
                  </div>
                  <h3 className="lp-modal-title">Live Event: Chennai Port Cyclone Michaung</h3>
                  <p className="lp-modal-subtitle">
                    Tracking shock propagation from regional terminal suspension to downstream assembly line shortages.
                  </p>
                </div>

                <div className="lp-scenario-modal-box">
                  <div className="lp-scen-news">
                    <span className="lp-scen-tag">HARVESTED NEWS INTELLIGENCE</span>
                    <h4>Chennai Port Container Terminal Paralyzed Following Cyclone Warning</h4>
                    <p>
                      &ldquo;Severe Cyclone Michaung has prompted port authorities at Chennai Port to suspend all berthing operations.
                      Vessel queues have backed up, threatening semiconductor exports destined for North American plants...&rdquo;
                    </p>
                    <div className="lp-scen-entities">
                      <span className="lp-ent-pill lp-ent-pill--origin">Chennai Port (Shock Origin)</span>
                      <span className="lp-ent-pill lp-ent-pill--supplier">Asia Semiconductor (Tier 1 Supplier)</span>
                      <span className="lp-ent-pill lp-ent-pill--cascade">Detroit Auto (Downstream Manufacturer)</span>
                    </div>
                  </div>

                  <div className="lp-scen-cascade">
                    <span className="lp-scen-tag">GNN CASCADE PROPAGATION</span>
                    <div className="lp-cascade-step">
                      <div className="lp-cascade-dot red" />
                      <div>
                        <strong>Tier 0 · Origin:</strong> Port of Chennai (Container Terminal)
                        <span className="lp-badge risk-crit">Severity 0.95</span>
                      </div>
                    </div>
                    <div className="lp-cascade-step">
                      <div className="lp-cascade-dot orange" />
                      <div>
                        <strong>Tier 1 · Direct Link:</strong> Asia Semiconductor Supply (Tamil Nadu)
                        <span className="lp-badge risk-high">Risk 0.82 (+14d Delay)</span>
                      </div>
                    </div>
                    <div className="lp-cascade-step">
                      <div className="lp-cascade-dot blue" />
                      <div>
                        <strong>Tier 2 · Assembly:</strong> North America Electronics (Detroit Plant)
                        <span className="lp-badge risk-high">Cascade 0.74 (Shortage)</span>
                      </div>
                    </div>
                    <div className="lp-cascade-step">
                      <div className="lp-cascade-dot green" />
                      <div>
                        <strong>Mitigation Recommendation:</strong> Reroute via Cochin or Ennore Corridor
                        <span className="lp-badge risk-ok">Corridor Ready</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lp-modal-footer">
                  <Link to={isAuthenticated ? '/dashboard' : '/signup'} className="lp-cta-btn">
                    Open Full Graph Scenario <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}

            {/* Modal: How It Works Pipeline */}
            {activeModal === 'how-it-works' && (
              <div className="lp-modal-content">
                <div className="lp-modal-header">
                  <div className="lp-pill">
                    <Cpu size={13} color="#00e5ff" />
                    <span>END-TO-END PIPELINE</span>
                  </div>
                  <h3 className="lp-modal-title">How AtmoGraph Works</h3>
                  <p className="lp-modal-subtitle">
                    A fully automated loop from raw global news to actionable supply chain risk intelligence.
                  </p>
                </div>

                <div className="lp-pipeline-steps">
                  {[
                    { n: '01', title: 'Global News Harvesting', desc: 'Continuous ingestion workers query trade feeds, maritime bulletins, and meteorological alerts in real time.' },
                    { n: '02', title: 'NLP Entity Extraction', desc: 'Disambiguates corporate entities, seaports, and geographic regions. Filters out news publishers.' },
                    { n: '03', title: 'Graph Knowledge Update', desc: 'Identifies matched Neo4j graph nodes, updates disruption scores, and tags shock origins.' },
                    { n: '04', title: 'GNN Shock Propagation', desc: 'Graph Neural Networks propagate shocks across adjacent edges, calculating multi-tier attenuation.' },
                    { n: '05', title: 'Temporal Forecast', desc: 'Projects cascading inventory depletion, delay duration, and recovery across 30, 60, and 90-day horizons.' },
                    { n: '06', title: 'Live Dashboard & Alerts', desc: 'Broadcasts live events via WebSockets to interactive charts and executive decision alerts.' }
                  ].map((s) => (
                    <div key={s.n} className="lp-step-card">
                      <span className="lp-step-num">{s.n}</span>
                      <div className="lp-step-info">
                        <h4>{s.title}</h4>
                        <p>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="lp-modal-footer">
                  <Link to={isAuthenticated ? '/dashboard' : '/signup'} className="lp-cta-btn">
                    Explore Platform Features <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}

            {/* Modal: About AtmoGraph */}
            {activeModal === 'about' && (
              <div className="lp-modal-content">
                <div className="lp-modal-header">
                  <div className="lp-pill">
                    <Sparkles size={13} color="#00e5ff" />
                    <span>PLATFORM VISION</span>
                  </div>
                  <h3 className="lp-modal-title">About AtmoGraph</h3>
                  <p className="lp-modal-subtitle">
                    Transforming unstructured world events into predictive supply chain intelligence.
                  </p>
                </div>

                <div className="lp-about-text">
                  <p>
                    AtmoGraph is an enterprise AI supply-chain intelligence platform designed to help
                    organizations understand how external disruptions propagate through interconnected networks.
                  </p>
                  <p>
                    Modern supply chains are complex and interdependent. Over 80% of critical manufacturing delays
                    originate beyond direct Tier-1 suppliers. AtmoGraph utilizes Graph Neural Networks and real-time
                    geopolitical and weather signals to model multi-tier vulnerabilities before they cascade.
                  </p>
                  <div className="lp-about-bullets">
                    <div className="lp-about-bullet"><Check size={16} color="#00e5ff" /> <span>Autonomous real-time event ingestion</span></div>
                    <div className="lp-about-bullet"><Check size={16} color="#00e5ff" /> <span>Multi-tier supplier ripple simulation</span></div>
                    <div className="lp-about-bullet"><Check size={16} color="#00e5ff" /> <span>Explainable Graph AI decision support</span></div>
                    <div className="lp-about-bullet"><Check size={16} color="#00e5ff" /> <span>30/60/90-day predictive recovery horizons</span></div>
                  </div>
                </div>

                <div className="lp-modal-footer">
                  <Link to={isAuthenticated ? '/dashboard' : '/signup'} className="lp-cta-btn">
                    Get Started With AtmoGraph <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}

            {/* Modal: Security by Design */}
            {activeModal === 'security' && (
              <div className="lp-modal-content">
                <div className="lp-modal-header">
                  <div className="lp-pill">
                    <ShieldCheck size={13} color="#00e5ff" />
                    <span>TRUST & SECURITY</span>
                  </div>
                  <h3 className="lp-modal-title">Security by Design</h3>
                  <p className="lp-modal-subtitle">
                    Enterprise-grade protection and data isolation at every layer of the architecture.
                  </p>
                </div>

                <div className="lp-modal-grid">
                  <div className="lp-modal-feature">
                    <div className="lp-modal-feat-icon"><KeyRound size={20} color="#00e5ff" /></div>
                    <h4>Stateless JWT Authentication</h4>
                    <p>Cryptographically signed HMAC-SHA256 tokens with salted bcrypt password hashing and token expiry.</p>
                  </div>
                  <div className="lp-modal-feature">
                    <div className="lp-modal-feat-icon"><ShieldCheck size={20} color="#38bdf8" /></div>
                    <h4>Protected API Endpoints</h4>
                    <p>FastAPI security dependencies verify credentials on all protected analytics and graph endpoints.</p>
                  </div>
                  <div className="lp-modal-feature">
                    <div className="lp-modal-feat-icon"><Lock size={20} color="#10b981" /></div>
                    <h4>Data Isolation</h4>
                    <p>Structured physical isolation between SQLite authentication stores and Neo4j graph databases.</p>
                  </div>
                  <div className="lp-modal-feature">
                    <div className="lp-modal-feat-icon"><FileCheck size={20} color="#f59e0b" /></div>
                    <h4>Pydantic Validation</h4>
                    <p>Strict schema enforcement, sanitization, and input regex checks eliminate injection vectors.</p>
                  </div>
                </div>

                <div className="lp-modal-footer">
                  <button onClick={() => setActiveModal(null)} className="lp-ghost-btn">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
