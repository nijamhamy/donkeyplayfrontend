import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Trophy, Play, Info, Settings, ArrowLeft, Share2, ShieldCheck, ExternalLink, Music, HelpCircle, Users } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Toast } from '@capacitor/toast';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';

// Your real Android banner ad unit
const BANNER_AD_UNIT_ID = 'ca-app-pub-8553625771070050/2654092188';

// Share content (Play Store link of the app)
const SHARE_TITLE = 'Donkey play';
const SHARE_TEXT = 'Join the ultimate Donkey play card strategy match!';
const SHARE_URL = 'https://play.google.com/store/apps/details?id=com.donkygame.app';

/* ------------------------------------------------------------------ */
/*  Styles (self-contained: 3D buttons, keyframes, felt table)         */
/* ------------------------------------------------------------------ */
const CSS = `
.dk-root{position:fixed;inset:0;overflow:hidden;display:flex;align-items:center;justify-content:center;
  padding:16px 16px 76px;color:#fff;font-family:'Trebuchet MS','Segoe UI',system-ui,sans-serif;
  background:
    radial-gradient(ellipse at 50% 35%, #1f8a4f 0%, #0f5a33 45%, #06301c 80%, #031a0f 100%);
  perspective:1000px;-webkit-tap-highlight-color:transparent;user-select:none}
.dk-root::before{content:'';position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(45deg,rgba(255,255,255,.025) 0 2px,transparent 2px 6px);}
.dk-root::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55) 100%);}

.dk-suit{position:absolute;bottom:-60px;font-weight:900;pointer-events:none;opacity:.16;
  animation:dkRise linear infinite}
@keyframes dkRise{
  0%{transform:translateY(0) rotate(0deg)}
  100%{transform:translateY(-115vh) rotate(360deg)}}

.dk-panel{position:relative;z-index:2;width:100%;max-width:400px;border-radius:34px;padding:22px 20px 20px;
  background:linear-gradient(160deg,rgba(18,40,28,.92),rgba(5,16,10,.95));
  border:2px solid rgba(250,204,21,.45);
  box-shadow:0 0 0 6px rgba(0,0,0,.25),0 28px 50px rgba(0,0,0,.65),
             inset 0 2px 0 rgba(255,255,255,.12),0 0 40px rgba(34,197,94,.25);
  transform-style:preserve-3d}

/* ---------- Title ---------- */
.dk-title{margin:6px 0 0;text-align:center;font-size:2.7rem;line-height:1;font-weight:900;letter-spacing:1px;
  color:#fde047;
  text-shadow:0 1px 0 #f59e0b,0 2px 0 #d97706,0 3px 0 #b45309,0 4px 0 #92400e,0 5px 0 #78350f,
              0 10px 14px rgba(0,0,0,.6),0 0 24px rgba(253,224,71,.35);
  animation:dkTitle 3.2s ease-in-out infinite}
@keyframes dkTitle{0%,100%{transform:translateZ(30px) rotate(-1.2deg)}50%{transform:translateZ(30px) rotate(1.2deg) scale(1.03)}}
.dk-sub{text-align:center;margin:12px 0 0;font-size:.72rem;font-weight:800;letter-spacing:3px;color:#86efac;opacity:.85}

/* ---------- Hero scene ---------- */
.dk-hero{position:relative;height:235px;margin-top:4px;transform-style:preserve-3d}
.dk-glow{position:absolute;left:50%;top:48%;width:210px;height:210px;margin:-105px 0 0 -105px;border-radius:50%;
  background:radial-gradient(circle,rgba(253,224,71,.38),rgba(34,197,94,.12) 55%,transparent 70%);
  animation:dkPulse 3s ease-in-out infinite}
@keyframes dkPulse{0%,100%{transform:scale(.9);opacity:.7}50%{transform:scale(1.12);opacity:1}}
.dk-shadow{position:absolute;left:50%;bottom:6px;width:140px;height:18px;margin-left:-70px;border-radius:50%;
  background:rgba(0,0,0,.55);filter:blur(7px);animation:dkShadow 2.6s ease-in-out infinite}
@keyframes dkShadow{0%,100%{transform:scale(1)}50%{transform:scale(.8);opacity:.5}}

.dk-donkey{position:absolute;left:50%;top:6px;width:178px;margin-left:-89px;transform:translateZ(60px);
  animation:dkBob 2.6s ease-in-out infinite;filter:drop-shadow(0 12px 10px rgba(0,0,0,.5))}
@keyframes dkBob{0%,100%{transform:translateZ(60px) translateY(0) rotate(-2deg)}
                 50%{transform:translateZ(60px) translateY(-9px) rotate(2deg)}}
.dk-earL{transform-origin:62px 70px;animation:dkEarL 2.4s ease-in-out infinite}
.dk-earR{transform-origin:138px 70px;animation:dkEarR 2.4s ease-in-out infinite .6s}
@keyframes dkEarL{0%,100%{transform:rotate(0)}40%{transform:rotate(-16deg)}60%{transform:rotate(6deg)}}
@keyframes dkEarR{0%,100%{transform:rotate(0)}40%{transform:rotate(16deg)}60%{transform:rotate(-6deg)}}
.dk-lid{transform-box:fill-box;transform-origin:center;animation:dkBlink 4s infinite}
@keyframes dkBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
.dk-nose{transform-box:fill-box;transform-origin:center;animation:dkSnort 3s ease-in-out infinite}
@keyframes dkSnort{0%,70%,100%{transform:scale(1)}80%{transform:scale(1.18,.9)}}

/* ---------- Playing cards ---------- */
.dk-card-wrap{position:absolute;left:50%;bottom:0;width:62px;height:88px;margin-left:-31px;transform-style:preserve-3d}
.dk-card{position:absolute;inset:0;border-radius:9px;background:linear-gradient(145deg,#fff,#e5e7eb);
  box-shadow:0 8px 14px rgba(0,0,0,.5),inset 0 0 0 1px rgba(0,0,0,.12);
  display:flex;align-items:center;justify-content:center;font-weight:900;overflow:hidden}
.dk-card::after{content:'';position:absolute;top:0;bottom:0;width:30%;left:-60%;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.9),transparent);
  transform:skewX(-20deg);animation:dkSheen 4.5s ease-in-out infinite}
@keyframes dkSheen{0%,60%{left:-60%}100%{left:130%}}
.dk-corner{position:absolute;left:5px;top:3px;font-size:.82rem;line-height:.95;text-align:center}
.dk-corner.br{left:auto;top:auto;right:5px;bottom:3px;transform:rotate(180deg)}
.dk-big{font-size:2rem}
.dk-fan{animation:dkFan 3.4s ease-in-out infinite}
@keyframes dkFan{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}

.dk-flip{position:absolute;right:-2px;top:4px;width:56px;height:80px;transform-style:preserve-3d;
  animation:dkFlip 4.5s ease-in-out infinite}
@keyframes dkFlip{0%{transform:translateZ(80px) rotateY(0) rotateZ(14deg) translateY(0)}
  50%{transform:translateZ(80px) rotateY(180deg) rotateZ(14deg) translateY(-14px)}
  100%{transform:translateZ(80px) rotateY(360deg) rotateZ(14deg) translateY(0)}}
.dk-flip .dk-card{backface-visibility:hidden;-webkit-backface-visibility:hidden}
.dk-back{background:repeating-linear-gradient(45deg,#b91c1c 0 6px,#7f1d1d 6px 12px)!important;
  border:4px solid #fff;transform:rotateY(180deg)}

.dk-coin{position:absolute;width:26px;height:26px;border-radius:50%;
  background:radial-gradient(circle at 30% 30%,#fff7b0,#facc15 50%,#a16207);
  box-shadow:0 4px 6px rgba(0,0,0,.5);animation:dkCoin 2.8s ease-in-out infinite;
  display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:900;color:#78350f}
@keyframes dkCoin{0%,100%{transform:translateY(0) rotateY(0)}50%{transform:translateY(-14px) rotateY(180deg)}}

/* ---------- 3D buttons ---------- */
.dk-btn{position:relative;width:100%;border:0;border-radius:18px;padding:14px 12px;overflow:hidden;
  display:flex;align-items:center;justify-content:center;gap:10px;
  font-weight:900;font-size:1.05rem;letter-spacing:1.5px;cursor:pointer;
  transition:transform .08s,box-shadow .08s;outline:none}
.dk-btn::after{content:'';position:absolute;top:0;bottom:0;width:35%;left:-60%;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);
  transform:skewX(-20deg);animation:dkSheen 3.6s ease-in-out infinite}
.dk-green{color:#fff;background:linear-gradient(#4ade80,#16a34a 55%,#15803d);
  box-shadow:0 7px 0 #0b5a2a,0 14px 20px rgba(0,0,0,.5),inset 0 2px 0 rgba(255,255,255,.45);
  text-shadow:0 2px 0 rgba(0,0,0,.3)}
.dk-gold{color:#4a2c05;background:linear-gradient(#fde68a,#fbbf24 55%,#f59e0b);
  box-shadow:0 7px 0 #92590a,0 14px 20px rgba(0,0,0,.5),inset 0 2px 0 rgba(255,255,255,.6)}
.dk-cream{color:#14532d;background:linear-gradient(#ffffff,#e2e8f0);font-size:.95rem;padding:12px 8px;
  box-shadow:0 6px 0 #8593a8,0 12px 16px rgba(0,0,0,.45),inset 0 2px 0 #fff}
.dk-btn:active{transform:translateY(6px)}
.dk-green:active{box-shadow:0 1px 0 #0b5a2a,0 4px 8px rgba(0,0,0,.5),inset 0 2px 0 rgba(255,255,255,.45)}
.dk-gold:active{box-shadow:0 1px 0 #92590a,0 4px 8px rgba(0,0,0,.5),inset 0 2px 0 rgba(255,255,255,.6)}
.dk-cream:active{box-shadow:0 1px 0 #8593a8,0 3px 6px rgba(0,0,0,.45),inset 0 2px 0 #fff}
.dk-share{background:none;border:0;color:#a7f3d0;font-weight:800;margin-top:6px;padding:8px;
  display:flex;align-items:center;justify-content:center;gap:8px;width:100%;cursor:pointer}

/* ---------- Sub screens ---------- */
.dk-back-btn{width:40px;height:40px;border-radius:50%;border:0;color:#fff;margin-right:12px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;background:linear-gradient(#374151,#111827);
  box-shadow:0 4px 0 #000,0 8px 10px rgba(0,0,0,.5)}
.dk-back-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #000}
.dk-h{margin:0;font-weight:900;color:#4ade80;font-size:1.35rem;text-shadow:0 2px 0 #052e16}
.dk-row{display:flex;align-items:center;justify-content:space-between;padding:14px;border-radius:18px;
  background:linear-gradient(160deg,rgba(255,255,255,.1),rgba(255,255,255,.03));
  border:1px solid rgba(255,255,255,.18);box-shadow:0 5px 0 rgba(0,0,0,.4);color:#fff;text-decoration:none;cursor:pointer}
.dk-tip{padding:14px;border-radius:18px;margin-bottom:12px;font-size:.88rem;
  background:linear-gradient(160deg,rgba(255,255,255,.1),rgba(255,255,255,.03));
  border:1px solid rgba(255,255,255,.18);box-shadow:0 5px 0 rgba(0,0,0,.4)}
.dk-tip h6{margin:0 0 6px;color:#fde047;font-weight:900;font-size:.95rem}
.dk-tip p{margin:0;opacity:.85;line-height:1.45}
.dk-switch{width:52px;height:30px;border-radius:30px;border:0;padding:3px;cursor:pointer;display:flex;
  transition:background .2s;box-shadow:inset 0 3px 5px rgba(0,0,0,.5)}
.dk-knob{width:24px;height:24px;border-radius:50%;background:linear-gradient(#fff,#cbd5e1);box-shadow:0 3px 4px rgba(0,0,0,.5)}

@media (prefers-reduced-motion:reduce){
  .dk-root *,.dk-root *::before,.dk-root *::after{animation:none!important}
}
`;

const SUITS = ['♠', '♥', '♦', '♣'];

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */
function PlayingCard({ rank, suit }) {
    const red = suit === '♥' || suit === '♦';
    const color = red ? '#dc2626' : '#111827';
    return (
        <div className="dk-card" style={{ color }}>
            <div className="dk-corner">{rank}<br />{suit}</div>
            <div className="dk-big">{suit}</div>
            <div className="dk-corner br">{rank}<br />{suit}</div>
        </div>
    );
}

function DonkeySVG() {
    return (
        <svg viewBox="0 0 200 210" width="100%" aria-label="Donkey mascot">
            <defs>
                <radialGradient id="dkFur" cx="50%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#c2b4a6" />
                    <stop offset="100%" stopColor="#8a7a6c" />
                </radialGradient>
                <radialGradient id="dkMuz" cx="50%" cy="35%" r="70%">
                    <stop offset="0%" stopColor="#fff4e2" />
                    <stop offset="100%" stopColor="#e3cfb4" />
                </radialGradient>
            </defs>

            {/* ears */}
            <g className="dk-earL">
                <path d="M62 78 C28 40 34 4 52 6 C68 8 80 44 82 70 Z" fill="url(#dkFur)" stroke="#5b4a3c" strokeWidth="3" />
                <path d="M62 66 C44 40 44 20 52 18 C62 20 70 44 72 62 Z" fill="#f4a7b9" />
            </g>
            <g className="dk-earR">
                <path d="M138 78 C172 40 166 4 148 6 C132 8 120 44 118 70 Z" fill="url(#dkFur)" stroke="#5b4a3c" strokeWidth="3" />
                <path d="M138 66 C156 40 156 20 148 18 C138 20 130 44 128 62 Z" fill="#f4a7b9" />
            </g>

            {/* head */}
            <path d="M100 52 C146 52 156 92 150 128 C146 166 126 190 100 190 C74 190 54 166 50 128 C44 92 54 52 100 52 Z"
                fill="url(#dkFur)" stroke="#5b4a3c" strokeWidth="3.5" />

            {/* forelock / mane */}
            <path d="M74 56 C80 34 120 34 126 56 C116 50 108 66 100 74 C92 66 84 50 74 56 Z" fill="#2f2620" />

            {/* eyes */}
            <g className="dk-lid">
                <ellipse cx="76" cy="108" rx="14" ry="16" fill="#fff" stroke="#5b4a3c" strokeWidth="2.5" />
                <circle cx="79" cy="110" r="8" fill="#2a1d14" /><circle cx="82" cy="106" r="3" fill="#fff" />
            </g>
            <g className="dk-lid">
                <ellipse cx="124" cy="108" rx="14" ry="16" fill="#fff" stroke="#5b4a3c" strokeWidth="2.5" />
                <circle cx="121" cy="110" r="8" fill="#2a1d14" /><circle cx="124" cy="106" r="3" fill="#fff" />
            </g>

            {/* cheeks */}
            <ellipse cx="62" cy="140" rx="9" ry="6" fill="#f4a7b9" opacity=".6" />
            <ellipse cx="138" cy="140" rx="9" ry="6" fill="#f4a7b9" opacity=".6" />

            {/* muzzle */}
            <ellipse cx="100" cy="158" rx="36" ry="28" fill="url(#dkMuz)" stroke="#5b4a3c" strokeWidth="3" />
            <g className="dk-nose">
                <ellipse cx="88" cy="150" rx="5.5" ry="7" fill="#3a2b22" />
                <ellipse cx="112" cy="150" rx="5.5" ry="7" fill="#3a2b22" />
            </g>
            <path d="M82 170 Q100 184 118 170" fill="none" stroke="#5b4a3c" strokeWidth="3.5" strokeLinecap="round" />
            {/* tooth */}
            <rect x="95" y="174" width="10" height="9" rx="2" fill="#fff" stroke="#5b4a3c" strokeWidth="1.8" />
        </svg>
    );
}

function Hero() {
    // mouse / touch tilt for real 3D parallax
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const rotX = useSpring(useTransform(my, [-1, 1], [12, -12]), { stiffness: 90, damping: 14 });
    const rotY = useSpring(useTransform(mx, [-1, 1], [-18, 18]), { stiffness: 90, damping: 14 });

    const onMove = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
        my.set(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const onLeave = () => { mx.set(0); my.set(0); };

    const fan = [
        { rank: 'A', suit: '♠', rot: -32, x: -92, delay: 0 },
        { rank: 'K', suit: '♥', rot: -11, x: -34, delay: 0.3 },
        { rank: 'Q', suit: '♦', rot: 11, x: 34, delay: 0.6 },
        { rank: 'J', suit: '♣', rot: 32, x: 92, delay: 0.9 },
    ];

    return (
        <motion.div
            className="dk-hero"
            style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 900 }}
            onPointerMove={onMove}
            onPointerLeave={onLeave}
            initial={{ scale: 0.4, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 130, damping: 11 }}
        >
            <div className="dk-glow" />
            <div className="dk-shadow" />

            {/* fanned poker cards */}
            {fan.map((c, i) => (
                <div key={i} className="dk-card-wrap"
                    style={{ transform: `translateX(${c.x}px) rotate(${c.rot}deg) translateZ(${20 + i * 6}px)`, transformOrigin: '50% 100%', zIndex: i }}>
                    <div className="dk-fan" style={{ animationDelay: `${c.delay}s`, width: '100%', height: '100%', position: 'relative' }}>
                        <PlayingCard rank={c.rank} suit={c.suit} />
                    </div>
                </div>
            ))}

            {/* donkey mascot */}
            <div className="dk-donkey"><DonkeySVG /></div>

            {/* flipping card */}
            <div className="dk-flip">
                <div className="dk-card" style={{ color: '#dc2626' }}>
                    <div className="dk-corner">10<br />♥</div>
                    <div className="dk-big">♥</div>
                </div>
                <div className="dk-card dk-back" />
            </div>

            {/* floating coins */}
            <div className="dk-coin" style={{ left: 6, top: 30, animationDelay: '0s' }}>★</div>
            <div className="dk-coin" style={{ left: 22, top: 118, animationDelay: '.9s', transform: 'scale(.75)' }}>★</div>
            <div className="dk-coin" style={{ right: 10, top: 120, animationDelay: '1.6s', transform: 'scale(.8)' }}>★</div>
        </motion.div>
    );
}

function Floaters() {
    const items = useMemo(
        () => Array.from({ length: 16 }, (_, i) => ({
            s: SUITS[i % 4],
            left: Math.round(Math.random() * 100),
            size: 24 + Math.round(Math.random() * 40),
            dur: 12 + Math.round(Math.random() * 14),
            delay: -Math.round(Math.random() * 20),
            red: i % 4 === 1 || i % 4 === 2,
        })),
        []
    );
    return (
        <>
            {items.map((it, i) => (
                <span key={i} className="dk-suit"
                    style={{ left: `${it.left}%`, fontSize: it.size, animationDuration: `${it.dur}s`, animationDelay: `${it.delay}s`, color: it.red ? '#fca5a5' : '#d1fae5' }}>
                    {it.s}
                </span>
            ))}
        </>
    );
}

const slide = { initial: { opacity: 0, x: 40, rotateY: -25 }, animate: { opacity: 1, x: 0, rotateY: 0 }, exit: { opacity: 0, x: -40, rotateY: 25 } };

function SubHeader({ title, onBack }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
            <button className="dk-back-btn" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
            <h4 className="dk-h">{title}</h4>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Sub views                                                          */
/* ------------------------------------------------------------------ */
function HelpView({ onBack }) {
    const tips = [
        ['The Start', <>The player holding the <strong>Ace of Spades (♠A)</strong> must lead the first round.</>],
        ['Following Suit', <>You must play a card of the same suit as the lead card. If you don't have it, you can play any <strong>Danger Card</strong> to strike.</>],
        ['The Strike', <>If a danger card is played, the person who played the highest card of the original suit collects all cards on the table.</>],
        ['Winning', <>Finish all your cards to win. The last person left with cards is the <strong>Donkey play!</strong></>],
    ];
    return (
        <motion.div {...slide} transition={{ duration: 0.3 }} style={{ position: 'relative', zIndex: 2 }}>
            <SubHeader title="How to Play" onBack={onBack} />
            <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
                {tips.map(([h, p], i) => (
                    <motion.div key={h} className="dk-tip" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}>
                        <h6>{h}</h6><p>{p}</p>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

function SettingsView({ onBack, onAbout, musicEnabled, setMusicEnabled }) {
    return (
        <motion.div {...slide} transition={{ duration: 0.3 }} style={{ position: 'relative', zIndex: 2 }}>
            <SubHeader title="Settings" onBack={onBack} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="dk-row" style={{ cursor: 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Music size={20} color="#22d3ee" /><span>Background Music</span>
                    </div>
                    <button className="dk-switch" aria-label="Toggle music"
                        style={{ background: musicEnabled ? '#22c55e' : '#4b5563', justifyContent: musicEnabled ? 'flex-end' : 'flex-start' }}
                        onClick={() => setMusicEnabled(!musicEnabled)}>
                        <motion.div layout className="dk-knob" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                    </button>
                </div>

                <div className="dk-row" onClick={onAbout}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Info size={20} color="#facc15" /><span>About Game</span>
                    </div>
                    <ArrowLeft size={16} style={{ transform: 'rotate(180deg)', opacity: 0.5 }} />
                </div>

                <a className="dk-row" style={{ borderColor: 'rgba(34,197,94,.5)' }}
                    href="https://doc-hosting.flycricket.io/donky-play-privacy-policy/28981be2-afa3-4ad8-a4ef-7aede313160b/privacy"
                    target="_blank" rel="noopener noreferrer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ShieldCheck size={20} color="#22c55e" /><span>Privacy Policy</span>
                    </div>
                    <ExternalLink size={16} color="#9ca3af" />
                </a>
            </div>
        </motion.div>
    );
}

function AboutView({ onBack }) {
    return (
        <motion.div {...slide} transition={{ duration: 0.3 }} style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
            <div style={{ textAlign: 'left' }}><SubHeader title="About" onBack={onBack} /></div>
            <motion.div animate={{ rotateY: 360 }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block', marginTop: 16 }}>
                <Trophy size={64} color="#facc15" />
            </motion.div>
            <h5 style={{ fontWeight: 900, marginTop: 12 }}>Donkey play Pro</h5>
            <p style={{ fontSize: '.8rem', opacity: 0.5, margin: '4px 0 12px' }}>Version 1.0.26</p>
            <p style={{ fontSize: '.85rem', opacity: 0.8, padding: '0 10px' }}>
                Developed with passion for card game lovers. Experience the classic strategy game with premium AI and smooth animations.
            </p>
            <div style={{ marginTop: 36, fontSize: '.75rem', color: '#9ca3af' }}>© 2026 Donkey play Gaming Studio</div>
        </motion.div>
    );
}

/* ------------------------------------------------------------------ */
/*  Home                                                               */
/* ------------------------------------------------------------------ */
export default function Home({ onStart, onMultiplayer }) {
    // Current screen: 'MAIN', 'HELP', 'SETTINGS', 'ABOUT'
    const [view, setView] = useState('MAIN');
    const [musicEnabled, setMusicEnabled] = useState(true);

    // ---- Banner Ad: shown only while Home is mounted ----
    useEffect(() => {
        let bannerShown = false;

        const showBanner = async () => {
            if (!Capacitor.isNativePlatform()) return; // skip on web preview

            try {
                const options = {
                    adId: BANNER_AD_UNIT_ID,
                    adSize: BannerAdSize.ADAPTIVE_BANNER,
                    position: BannerAdPosition.BOTTOM_CENTER,
                    margin: 0, // plugin auto-avoids the Android system nav bar / gesture bar
                    isTesting: false, // real ad unit — keep false in production
                };

                await AdMob.showBanner(options);
                bannerShown = true;
            } catch (err) {
                console.warn('AdMob banner failed to show:', err);
            }
        };

        showBanner();

        // Cleanup: hide + remove banner when leaving this screen
        return () => {
            if (bannerShown && Capacitor.isNativePlatform()) {
                AdMob.removeBanner().catch((err) =>
                    console.warn('AdMob banner failed to remove:', err)
                );
            }
        };
    }, []);

    // ✅ FIXED: navigator.share does NOT exist in the Android WebView, so the old
    // button did nothing on mobile. Now it uses the native Capacitor Share sheet
    // (works on Android/iOS). Fallbacks: browser share -> copy link to clipboard.
    const handleShare = async () => {
        const isCancel = (err) => /cancel/i.test(String(err?.message || err || ''));

        // 1) Native share sheet (installed app on a phone)
        if (Capacitor.isNativePlatform()) {
            try {
                await Share.share({
                    title: SHARE_TITLE,
                    text: SHARE_TEXT,
                    url: SHARE_URL,
                    dialogTitle: 'Share Donkey play',
                });
                return;
            } catch (err) {
                if (isCancel(err)) return; // user closed the share sheet
                // otherwise fall through to the fallbacks below
            }
        }

        // 2) Browser Web Share API (mobile browsers / web preview)
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL });
                return;
            } catch (err) {
                if (isCancel(err) || err?.name === 'AbortError') return;
            }
        }

        // 3) Last resort: copy the Play Store link
        try {
            await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
            if (Capacitor.isNativePlatform()) {
                Toast.show({ text: 'Link copied!', duration: 'short' });
            } else {
                alert('Link copied!');
            }
        } catch (err) {
            alert(`Share this link:\n${SHARE_URL}`);
        }
    };

    return (
        <div className="dk-root">
            <style>{CSS}</style>
            <Floaters />

            <div className="dk-panel">
                <AnimatePresence mode="wait">
                    {view === 'MAIN' && (
                        <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                            style={{ position: 'relative', zIndex: 2 }}>
                            <Hero />

                            <motion.h1 className="dk-title" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                transition={{ type: 'spring', delay: 0.25, stiffness: 140, damping: 10 }}>
                                Donkey play
                            </motion.h1>
                            <p className="dk-sub">PREMIUM STRATEGY MATCH</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
                                <motion.button className="dk-btn dk-green"
                                    initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1, scale: [1, 1.035, 1] }}
                                    transition={{ x: { type: 'spring', delay: 0.4 }, opacity: { delay: 0.4 }, scale: { delay: 1.2, duration: 1.6, repeat: Infinity } }}
                                    whileTap={{ scale: 0.97 }} onClick={onStart}>
                                    <Play size={24} fill="currentColor" /> START GAME
                                </motion.button>

                                <motion.button className="dk-btn dk-gold"
                                    initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                                    transition={{ type: 'spring', delay: 0.55 }}
                                    whileTap={{ scale: 0.97 }} onClick={onMultiplayer}>
                                    <Users size={22} /> MULTIPLAYER
                                </motion.button>

                                <div style={{ display: 'flex', gap: 12 }}>
                                    <motion.button className="dk-btn dk-cream" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                        transition={{ type: 'spring', delay: 0.7 }} whileTap={{ scale: 0.96 }} onClick={() => setView('HELP')}>
                                        <HelpCircle size={18} /> Help
                                    </motion.button>
                                    <motion.button className="dk-btn dk-cream" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                        transition={{ type: 'spring', delay: 0.8 }} whileTap={{ scale: 0.96 }} onClick={() => setView('SETTINGS')}>
                                        <Settings size={18} /> Settings
                                    </motion.button>
                                </div>

                                <motion.button className="dk-share" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                                    whileTap={{ scale: 0.92 }} onClick={handleShare}>
                                    <Share2 size={18} /> Share Game
                                </motion.button>
                            </div>
                        </motion.div>
                    )}

                    {view === 'HELP' && <HelpView key="help" onBack={() => setView('MAIN')} />}
                    {view === 'SETTINGS' && (
                        <SettingsView key="settings" onBack={() => setView('MAIN')} onAbout={() => setView('ABOUT')}
                            musicEnabled={musicEnabled} setMusicEnabled={setMusicEnabled} />
                    )}
                    {view === 'ABOUT' && <AboutView key="about" onBack={() => setView('SETTINGS')} />}
                </AnimatePresence>
            </div>
        </div>
    );
}