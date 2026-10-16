import React, { useState, useEffect, useRef, useMemo } from 'react';

// Constantes geométricas del montacargas (en centímetros)
const FORKLIFT_GEO = {
  wheelbase: 140,      // cm entre ejes
  frontAxleToMast: 38, // cm eje a cara portahorquillas
  mastPivotH: 32,      // cm altura pivote
  frontRadius: 24,     // radio rueda delantera (cm)
  rearRadius: 18,      // radio rueda trasera (cm)
  forkliftCG_Y: 52     // altura CG máquina (cm)
};

export default function App() {
  // ------------------------------------------
  // ESTADO DE CONFIGURACIÓN Y FÍSICA
  // ------------------------------------------
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  // 1. Montacargas
  const [forkliftOption, setForkliftOption] = useState<string>('standard');
  const [forkliftWeight, setForkliftWeight] = useState<number>(3800);
  const [distCG, setDistCG] = useState<number>(70);

  // 2. Carga
  const [loadOption, setLoadOption] = useState<string>('1500');
  const [loadWeight, setLoadWeight] = useState<number>(1500);
  const [loadCenter, setLoadCenter] = useState<number>(60);

  // 3. Altura
  const [heightOption, setHeightOption] = useState<string>('0.2');
  const [mastHeight, setMastHeight] = useState<number>(0.2);

  // 4. Inclinación
  const [tiltOption, setTiltOption] = useState<string>('0');
  const [tiltAngle, setTiltAngle] = useState<number>(0);

  // 5. Velocidad y frenado
  const [speedOption, setSpeedOption] = useState<string>('0');
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [deceleration, setDeceleration] = useState<number>(0.0);
  const [custBrakeType, setCustBrakeType] = useState<string>('normal');

  // Referencias a canvas
  const splashCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const forkliftCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ------------------------------------------
  // A. SPLASH SCREEN CON PARTÍCULAS VERDES
  // ------------------------------------------
  useEffect(() => {
    const canvas = splashCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
    }

    let particles: Particle[] = [];

    const initParticles = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 9000);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          r: Math.random() * 2.5 + 1.5,
        });
      }
    };

    initParticles();
    window.addEventListener('resize', initParticles);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(132, 204, 22, 0.6)';
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 90) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(132, 204, 22, ${0.35 * (1 - dist / 90)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(render);
    };

    render();

    const fadeTimer = setTimeout(() => {
      setSplashFading(true);
      setTimeout(() => setSplashVisible(false), 700);
    }, 2600);

    return () => {
      window.removeEventListener('resize', initParticles);
      cancelAnimationFrame(animId);
      clearTimeout(fadeTimer);
    };
  }, []);

  const dismissSplash = () => {
    setSplashFading(true);
    setTimeout(() => setSplashVisible(false), 700);
  };

  // ------------------------------------------
  // B. FÍSICA Y CÁLCULOS
  // ------------------------------------------
  const physics = useMemo(() => {
    const ME = forkliftWeight * distCG;

    const heightCm = mastHeight * 100;
    const angleRad = (tiltAngle * Math.PI) / 180;
    const tiltOffsetX = heightCm * Math.sin(angleRad);
    const effectiveLoadArmX =
      FORKLIFT_GEO.frontAxleToMast + loadCenter * Math.cos(angleRad) + tiltOffsetX;
    const effectiveLoadHeightY =
      FORKLIFT_GEO.mastPivotH + heightCm * Math.cos(angleRad);

    const staticMoment = loadWeight * effectiveLoadArmX;
    const inertiaForceKg = loadWeight * (deceleration / 9.81);
    const dynamicInertiaMoment = inertiaForceKg * effectiveLoadHeightY;

    const MV = staticMoment + dynamicInertiaMoment;
    const FS = MV > 0 ? ME / MV : 999;

    const totalMass = forkliftWeight + loadWeight;
    const combinedCG_X =
      totalMass > 0
        ? (-forkliftWeight * distCG + loadWeight * effectiveLoadArmX) / totalMass
        : -distCG;

    const combinedCG_Y =
      totalMass > 0
        ? (forkliftWeight * FORKLIFT_GEO.forkliftCG_Y +
            loadWeight * effectiveLoadHeightY) /
          totalMass
        : FORKLIFT_GEO.forkliftCG_Y;

    return {
      ME,
      MV,
      FS,
      combinedCG_X,
      combinedCG_Y,
      effectiveLoadArmX,
      effectiveLoadHeightY,
    };
  }, [
    forkliftWeight,
    distCG,
    loadWeight,
    loadCenter,
    mastHeight,
    tiltAngle,
    deceleration,
  ]);

  // ------------------------------------------
  // C. DIBUJO REALISTA EN CANVAS 2D CON AUTO-FIT
  // ------------------------------------------
  useEffect(() => {
    const canvas = forkliftCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // Fondo técnico industrial limpio
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, W, H);

    // Ajuste dinámico de escala vertical para que cuando suba la carga, se alcance a ver perfectamente en móvil
    const maxMastH = mastHeight * 100; // altura en cm
    const requiredHeightCm = Math.max(220, maxMastH + 95);
    const groundY = H * 0.86;
    const scaleY = (H * 0.76) / requiredHeightCm;
    const scaleX = W / 320;
    const scale = Math.min(scaleX, scaleY);

    const frontAxleX = W * 0.46; // Eje delantero / fulcro
    const rearAxleX = frontAxleX - FORKLIFT_GEO.wheelbase * scale;
    const frontR = FORKLIFT_GEO.frontRadius * scale;
    const rearR = FORKLIFT_GEO.rearRadius * scale;
    const mastPivotX = frontAxleX + 12 * scale;
    const mastPivotY = groundY - FORKLIFT_GEO.mastPivotH * scale;

    // Cuadrícula técnica sutil
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, groundY);
      ctx.stroke();
    }

    // Suelo industrial reforzado
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    // Inclinación de volcadura si FS < 1.0
    let tipRot = 0;
    if (physics.FS < 1.0) {
      tipRot = Math.min(0.28, (1.0 - physics.FS) * 0.35);
    }

    ctx.save();
    ctx.translate(frontAxleX, groundY - frontR);
    ctx.rotate(tipRot);
    ctx.translate(-frontAxleX, -(groundY - frontR));

    // 1. CHASIS Y CONTRAPESO ULTRA-REALISTA (AMARILLO INDUSTRIAL)
    ctx.fillStyle = '#d97706'; // Ámbar industrial oscuro
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rearAxleX - 25 * scale, groundY - frontR + 4 * scale);
    ctx.bezierCurveTo(
      rearAxleX - 52 * scale,
      groundY - 25 * scale,
      rearAxleX - 54 * scale,
      groundY - 72 * scale,
      rearAxleX - 30 * scale,
      groundY - 82 * scale
    );
    ctx.lineTo(frontAxleX - 22 * scale, groundY - 82 * scale);
    ctx.lineTo(frontAxleX - 6 * scale, groundY - 50 * scale);
    ctx.lineTo(frontAxleX + 10 * scale, groundY - 50 * scale);
    ctx.lineTo(frontAxleX + 14 * scale, groundY - frontR + 4 * scale);
    ctx.lineTo(rearAxleX + 10 * scale, groundY - frontR + 4 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rayas de advertencia en contrapeso trasero
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(rearAxleX - 48 * scale, groundY - 45 * scale, 6 * scale, 18 * scale);
    ctx.fillRect(rearAxleX - 38 * scale, groundY - 50 * scale, 6 * scale, 22 * scale);

    // 2. COMPARTIMENTO DEL OPERADOR Y ASIENTO SUSPENDIDO
    const seatX = frontAxleX - 54 * scale;
    const seatY = groundY - 82 * scale;
    
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(seatX, seatY - 10 * scale, 22 * scale, 10 * scale, 4);
    ctx.fill();
    ctx.fillRect(seatX - 4 * scale, seatY - 28 * scale, 7 * scale, 20 * scale);

    // Operador
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(seatX + 9 * scale, seatY - 18 * scale, 7 * scale, 11 * scale, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(seatX + 4 * scale, seatY - 24 * scale, 6 * scale, 12 * scale);
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(seatX + 11 * scale, seatY - 35 * scale, 5.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(seatX + 11 * scale, seatY - 37 * scale, 6 * scale, Math.PI, Math.PI * 2);
    ctx.fill();

    // Volante
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(seatX + 22 * scale, seatY - 30 * scale);
    ctx.lineTo(seatX + 30 * scale, seatY - 42 * scale);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(seatX + 30 * scale, seatY - 42 * scale, 8 * scale, 3 * scale, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Jaula de protección
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(rearAxleX - 16 * scale, groundY - 82 * scale);
    ctx.lineTo(rearAxleX - 14 * scale, groundY - 132 * scale);
    ctx.lineTo(frontAxleX - 2 * scale, groundY - 134 * scale);
    ctx.lineTo(frontAxleX + 4 * scale, groundY - 50 * scale);
    ctx.stroke();

    // Giroflex
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(rearAxleX - 14 * scale, groundY - 138 * scale, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(rearAxleX - 15 * scale, groundY - 140 * scale, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();

    // 3. RUEDAS
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(rearAxleX, groundY - rearR, rearR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(rearAxleX, groundY - rearR, rearR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(rearAxleX, groundY - rearR, rearR * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(frontAxleX, groundY - frontR, frontR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(frontAxleX, groundY - frontR, frontR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(frontAxleX, groundY - frontR, frontR * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Fulcro marcador
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(frontAxleX, groundY);
    ctx.lineTo(frontAxleX - 6 * scale, groundY + 8 * scale);
    ctx.lineTo(frontAxleX + 6 * scale, groundY + 8 * scale);
    ctx.closePath();
    ctx.fill();

    // 4. MÁSTIL Y CARGA
    const mastAngleRad = (tiltAngle * Math.PI) / 180;
    const mastVisualLen = (mastHeight * 100 + 45) * scale;

    ctx.save();
    ctx.translate(mastPivotX, mastPivotY);
    ctx.rotate(mastAngleRad);

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 6 * scale;
    ctx.beginPath();
    ctx.moveTo(-18 * scale, -10 * scale);
    ctx.lineTo(-6 * scale, -mastVisualLen * 0.35);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.fillRect(-7 * scale, -mastVisualLen, 14 * scale, mastVisualLen);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-7 * scale, -mastVisualLen, 14 * scale, mastVisualLen);

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-3 * scale, -mastVisualLen + 10 * scale, 6 * scale, mastVisualLen - 15 * scale);

    const carriageRelY = -(mastHeight * 100) * scale;
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-9 * scale, carriageRelY - 12 * scale, 18 * scale, 20 * scale);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.strokeRect(-9 * scale, carriageRelY - 12 * scale, 18 * scale, 20 * scale);

    const forkLenPx = loadCenter * 1.6 * scale;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(9 * scale, carriageRelY - 12 * scale);
    ctx.lineTo(9 * scale, carriageRelY + 8 * scale);
    ctx.lineTo(9 * scale + forkLenPx, carriageRelY + 8 * scale);
    ctx.stroke();

    if (loadWeight > 0) {
      const palletW = Math.max(35, loadCenter * 1.5) * scale;
      const palletH = 9 * scale;
      const boxH = Math.min(48 * scale, Math.max(30 * scale, loadWeight * 0.012 * scale));
      const boxX = 10 * scale;
      const boxY = carriageRelY + 8 * scale - palletH - boxH;

      ctx.fillStyle = '#92400e';
      ctx.fillRect(boxX, carriageRelY + 8 * scale - palletH, palletW, palletH);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, carriageRelY + 8 * scale - palletH, palletW, palletH);

      ctx.fillStyle = '#451a03';
      ctx.fillRect(boxX + 2 * scale, carriageRelY + 8 * scale - palletH, 6 * scale, palletH);
      ctx.fillRect(boxX + palletW * 0.5 - 3 * scale, carriageRelY + 8 * scale - palletH, 6 * scale, palletH);
      ctx.fillRect(boxX + palletW - 8 * scale, carriageRelY + 8 * scale - palletH, 6 * scale, palletH);

      const boxColor =
        physics.FS < 1.0 ? '#dc2626' : physics.FS < 1.25 ? '#d97706' : '#2563eb';
      ctx.fillStyle = boxColor;
      ctx.fillRect(boxX, boxY, palletW, boxH);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, palletW, boxH);

      ctx.fillStyle = '#fef08a';
      ctx.fillRect(boxX + 8 * scale, boxY + 8 * scale, 12 * scale, 12 * scale);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "Inter", sans-serif';
      ctx.fillText(`${loadWeight.toLocaleString()} kg`, boxX + 24 * scale, boxY + boxH * 0.55);

      const cgLoadX = boxX + palletW * 0.5;
      const cgLoadY = boxY + boxH * 0.5;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(cgLoadX, cgLoadY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();

    const cgForkX = frontAxleX - distCG * scale;
    const cgForkY = groundY - FORKLIFT_GEO.forkliftCG_Y * scale;
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(cgForkX, cgForkY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const combX = frontAxleX + physics.combinedCG_X * scale;
    const combY = groundY - physics.combinedCG_Y * scale;
    const combColor =
      physics.FS < 1.0 ? '#dc2626' : physics.FS < 1.25 ? '#d97706' : '#7e22ce';

    ctx.strokeStyle = combColor;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(combX, combY);
    ctx.lineTo(combX, groundY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = combColor;
    ctx.beginPath();
    ctx.arc(combX, combY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }, [physics, mastHeight, tiltAngle, loadWeight, loadCenter, distCG]);

  useEffect(() => {
    const handleResize = () => {
      if (forkliftCanvasRef.current) {
        setMastHeight((prev) => prev);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleForkliftChange = (val: string) => {
    setForkliftOption(val);
    if (val === 'light') {
      setForkliftWeight(2800);
      setDistCG(65);
    } else if (val === 'standard') {
      setForkliftWeight(3800);
      setDistCG(70);
    } else if (val === 'medium') {
      setForkliftWeight(4900);
      setDistCG(80);
    } else if (val === 'heavy') {
      setForkliftWeight(7200);
      setDistCG(95);
    }
  };

  const handleLoadChange = (val: string) => {
    setLoadOption(val);
    if (val !== 'custom') {
      setLoadWeight(parseFloat(val));
      setLoadCenter(60);
    }
  };

  const handleHeightChange = (val: string) => {
    setHeightOption(val);
    if (val !== 'custom') {
      setMastHeight(parseFloat(val));
    }
  };

  const handleTiltChange = (val: string) => {
    setTiltOption(val);
    if (val !== 'custom') {
      setTiltAngle(parseFloat(val));
    }
  };

  const handleSpeedChange = (val: string) => {
    setSpeedOption(val);
    if (val === '0') {
      setSpeedKmh(0);
      setDeceleration(0.0);
    } else if (val === '5') {
      setSpeedKmh(5);
      setDeceleration(0.8);
    } else if (val === '10') {
      setSpeedKmh(10);
      setDeceleration(1.8);
    } else if (val === '15') {
      setSpeedKmh(15);
      setDeceleration(2.6);
    } else if (val === 'panic_10') {
      setSpeedKmh(10);
      setDeceleration(3.8);
    } else if (val === 'custom') {
      setDeceleration(custBrakeType === 'panic' ? 3.8 : 1.8);
    }
  };

  const handleCustomSpeedInput = (newSpeed: number, brakeType: string) => {
    setSpeedKmh(newSpeed);
    if (newSpeed === 0) {
      setDeceleration(0);
    } else {
      setDeceleration(brakeType === 'panic' ? 3.8 : 1.8);
    }
  };

  const handleReset = () => {
    setForkliftOption('standard');
    setForkliftWeight(3800);
    setDistCG(70);

    setLoadOption('1500');
    setLoadWeight(1500);
    setLoadCenter(60);

    setHeightOption('0.2');
    setMastHeight(0.2);

    setTiltOption('0');
    setTiltAngle(0);

    setSpeedOption('0');
    setSpeedKmh(0);
    setDeceleration(0.0);
    setCustBrakeType('normal');
  };

  const pctSafe =
    ((physics.combinedCG_X + FORKLIFT_GEO.wheelbase) / FORKLIFT_GEO.wheelbase) *
    100;
  const clampedMarkerPct = Math.max(4, Math.min(96, 100 - pctSafe));
  const isDanger = physics.FS < 1.0 || physics.combinedCG_X > 0;
  const isCaution = !isDanger && (physics.FS < 1.25 || physics.combinedCG_X > -15);
  const fsText = physics.FS > 20 ? '> 20' : physics.FS.toFixed(2);

  return (
    <>
      {/* ========================================== */}
      {/* 1. PANTALLA DE BIENVENIDA (SPLASH SCREEN) */}
      {/* ========================================== */}
      {splashVisible && (
        <div
          id="splashScreen"
          onClick={dismissSplash}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white transition-opacity duration-700 ${
            splashFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <canvas
            ref={splashCanvasRef}
            id="splashCanvas"
            className="absolute inset-0 w-full h-full block pointer-events-none"
          />

          <div className="relative z-10 flex flex-col items-center px-6 text-center animate-fade-in">
            <div className="w-64 max-w-[78vw] mb-4">
              <img
                src="/comglob.png"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src.endsWith('/comglob.png')) {
                    target.src = 'public/comglob.png';
                  } else if (target.src.includes('public/comglob.png')) {
                    target.src = 'comglob.png';
                  }
                }}
                alt="Comunicación Global"
                className="w-full h-auto object-contain drop-shadow-sm"
              />
            </div>
            <p className="text-xs uppercase tracking-[0.4em] font-extrabold text-slate-500">
              PRESENTA
            </p>
            <div className="mt-8 flex items-center gap-1.5 text-[11px] text-lime-700 bg-lime-50 border border-lime-200 px-3 py-1 rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-lime-500 animate-ping"></span>
              <span>Cargando Simulador Físico...</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. APLICACIÓN PRINCIPAL (MOBILE OPTIMIZED) */}
      {/* ========================================== */}
      <div className="h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 select-none">
        
        {/* ENCABEZADO SUPERIOR BRANDING */}
        <header className="h-11 sm:h-12 bg-white border-b border-slate-200 px-3 flex items-center justify-between shrink-0 shadow-xs z-20">
          <div className="flex items-center gap-2">
            <img
              src="/comgico.png"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.endsWith('/comgico.png')) {
                  target.src = 'public/comgico.png';
                } else if (target.src.includes('public/comgico.png')) {
                  target.src = 'comgico.png';
                }
              }}
              alt="Logo"
              className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight leading-none">
                  Comunicación Global
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-lime-100 text-lime-800 border border-lime-300">
                  NOM-006
                </span>
              </div>
              <p className="text-[10px] text-slate-600 font-medium leading-none mt-0.5 hidden xs:block">
                Física de Estabilidad de Montacargas
              </p>
            </div>
          </div>

          <button
            id="btnReset"
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 text-slate-700 text-xs font-semibold transition cursor-pointer touch-manipulation"
          >
            <span>🔄</span>
            <span className="hidden xs:inline">Restablecer</span>
          </button>
        </header>

        {/* VISOR CANVAS 2D (Fijo y siempre visible ~28% en móvil para no encimar) */}
        <section className="h-[27dvh] sm:h-[30dvh] shrink-0 bg-slate-100 border-b border-slate-200 relative overflow-hidden">
          {/* Indicadores flotantes sobre el canvas */}
          <div className="absolute top-1.5 left-2 z-10 flex gap-1 text-[10px] font-mono-num font-semibold bg-white/95 backdrop-blur px-2 py-0.5 rounded border border-slate-200 text-slate-600 shadow-xs">
            <span>Fulcro:</span>
            <span className="text-blue-600 font-bold">Rueda Delantera</span>
          </div>

          <div className="absolute top-1.5 right-2 z-10 text-[10px] font-mono-num font-semibold bg-white/95 backdrop-blur px-2 py-0.5 rounded border border-slate-200 text-slate-700 shadow-xs">
            <span>Mástil: {tiltAngle}°</span> | <span className="text-amber-700 font-bold">{mastHeight}m</span>
          </div>

          <canvas
            ref={forkliftCanvasRef}
            id="forkliftCanvas"
            className="w-full h-full block"
          />

          {/* Leyenda ultracompacta */}
          <div className="absolute bottom-1 inset-x-0 flex justify-center items-center gap-2.5 text-[9px] font-medium text-slate-600 bg-white/90 py-0.5 border-t border-slate-200/50">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span> Fulcro
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span> CG Máq.
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> CG Carga
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span> CG Total
            </span>
          </div>
        </section>

        {/* ESTADO, SEMÁFORO Y FACTOR DE SEGURIDAD (~24%) */}
        <section
          id="sectionStatus"
          className={`shrink-0 p-2 sm:p-2.5 transition-colors duration-200 flex flex-col justify-between ${
            isDanger
              ? 'bg-red-100 border-b border-red-300'
              : isCaution
              ? 'bg-amber-50 border-b border-amber-300'
              : 'bg-emerald-50/70 border-b border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  id="dotStatus"
                  className={`w-2.5 h-2.5 rounded-full ${
                    isDanger
                      ? 'bg-red-600 animate-ping'
                      : isCaution
                      ? 'bg-amber-500'
                      : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                <span
                  id="textStatusTitle"
                  className={`text-[11px] sm:text-xs font-extrabold uppercase tracking-wide ${
                    isDanger
                      ? 'text-red-950'
                      : isCaution
                      ? 'text-amber-950'
                      : 'text-emerald-900'
                  }`}
                >
                  {isDanger
                    ? '🚨 ¡VOLCADURA FRONTAL!'
                    : isCaution
                    ? '⚠️ PRECAUCIÓN: LÍMITE'
                    : 'OPERACIÓN SEGURA'}
                </span>
              </div>
              <p
                className={`text-[9px] font-semibold mt-0.5 ${
                  isDanger
                    ? 'text-red-800'
                    : isCaution
                    ? 'text-amber-800'
                    : 'text-emerald-700'
                }`}
              >
                NOM-006-STPS & OSHA 1910.178
              </p>
            </div>

            <div className="text-right flex items-baseline gap-1.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                FACTOR SEG.
              </span>
              <span
                id="textFS"
                className={`text-xl sm:text-2xl font-black font-mono-num leading-none ${
                  isDanger
                    ? 'text-red-600 animate-pulse'
                    : isCaution
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                FS = {fsText}
              </span>
            </div>
          </div>

          {/* Tarjeta de diagnóstico */}
          <div
            id="boxStatusDetail"
            className={`border rounded-lg p-1.5 my-1 shadow-xs flex items-center gap-2 ${
              isDanger
                ? 'bg-white/95 border-red-300'
                : isCaution
                ? 'bg-white/95 border-amber-300'
                : 'bg-white/90 border-emerald-200'
            }`}
          >
            <span id="iconStatus" className="text-base sm:text-lg">
              {isDanger ? '❌' : isCaution ? '⚠️' : '✅'}
            </span>
            <div className="min-w-0">
              <p
                id="txtAdherence"
                className={`text-[11px] font-bold leading-tight truncate ${
                  isDanger
                    ? 'text-red-800'
                    : isCaution
                    ? 'text-amber-800'
                    : 'text-slate-800'
                }`}
              >
                {isDanger
                  ? 'Ruedas traseras en el aire (Sin dirección)'
                  : isCaution
                  ? 'Agarre trasero crítico mínimo'
                  : 'Ruedas traseras firmes con adherencia total'}
              </p>
              <p
                id="txtNorm"
                className="text-[9px] text-slate-600 leading-tight truncate"
              >
                {isDanger
                  ? 'NOM-006: Baje la carga de inmediato.'
                  : isCaution
                  ? 'Un bache o frenado brusco causará volcadura.'
                  : 'NOM-006: Condiciones óptimas para traslado.'}
              </p>
            </div>
          </div>

          {/* Barra de Sustentación */}
          <div>
            <div className="flex justify-between text-[9px] font-mono-num font-semibold text-slate-600 mb-0.5">
              <span>EJE TRASERO</span>
              <span id="txtCGPercent" className="text-slate-800 font-bold">
                CG al {Math.round(pctSafe)}%
              </span>
              <span>EJE DELANTERO</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full relative overflow-hidden flex">
              <div className="w-[70%] h-full bg-emerald-400"></div>
              <div className="w-[18%] h-full bg-amber-400"></div>
              <div className="w-[12%] h-full bg-red-500"></div>
              <div
                id="cgMarker"
                className="absolute top-0 bottom-0 w-2.5 bg-purple-700 rounded-full border border-white shadow-sm transform -translate-x-1/2 transition-all duration-100"
                style={{ left: `${clampedMarkerPct}%` }}
              />
            </div>
          </div>
        </section>

        {/* MENÚS DE CONFIGURACIÓN CON SCROLL FLUIDO TÁCTIL (Optimizado para evitar solapes) */}
        <main className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 space-y-2 pb-24 bg-white touch-auto">
          
          {/* 1. MONTACARGAS */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="selForklift"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-700"
              >
                1. Montacargas
              </label>
              <span
                id="badgeForklift"
                className="text-[10px] font-mono-num text-slate-600 font-semibold"
              >
                {forkliftWeight.toLocaleString()} kg / CG {distCG} cm
              </span>
            </div>
            <select
              id="selForklift"
              value={forkliftOption}
              onChange={(e) => handleForkliftChange(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-lime-500 focus:outline-none text-slate-800 cursor-pointer touch-manipulation"
            >
              <option value="light">Bodega Ligero (2,800 kg / CG 65 cm)</option>
              <option value="standard">Estándar 2.5 t (3,800 kg / CG 70 cm)</option>
              <option value="medium">Patio Mediano (4,900 kg / CG 80 cm)</option>
              <option value="heavy">Pesado 5.0 t (7,200 kg / CG 95 cm)</option>
              <option value="custom">✏️ Personalizar (Manual)...</option>
            </select>
            {forkliftOption === 'custom' && (
              <div
                id="customForkliftBox"
                className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200"
              >
                <div>
                  <span className="text-[10px] text-slate-600 block">Tara (kg):</span>
                  <input
                    type="number"
                    id="inpCustWeight"
                    value={forkliftWeight}
                    min="500"
                    max="25000"
                    onChange={(e) =>
                      setForkliftWeight(
                        Math.max(100, parseFloat(e.target.value) || 0)
                      )
                    }
                    className="w-full text-xs font-mono-num border border-slate-300 rounded p-1.5 bg-white touch-manipulation"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-600 block">CG Eje (cm):</span>
                  <input
                    type="number"
                    id="inpCustDistCG"
                    value={distCG}
                    min="20"
                    max="250"
                    onChange={(e) =>
                      setDistCG(Math.max(10, parseFloat(e.target.value) || 0))
                    }
                    className="w-full text-xs font-mono-num border border-slate-300 rounded p-1.5 bg-white touch-manipulation"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. PESO DE LA CARGA */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="selLoad"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-700"
              >
                2. Peso de Carga
              </label>
              <span
                id="badgeLoad"
                className="text-[10px] font-mono-num text-slate-600 font-semibold"
              >
                {loadWeight.toLocaleString()} kg @ {loadCenter} cm
              </span>
            </div>
            <select
              id="selLoad"
              value={loadOption}
              onChange={(e) => handleLoadChange(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-lime-500 focus:outline-none text-slate-800 cursor-pointer touch-manipulation"
            >
              <option value="0">Sin Carga (0 kg)</option>
              <option value="800">Tarima ligera (800 kg @ 60 cm)</option>
              <option value="1500">Tarima estándar (1,500 kg @ 60 cm)</option>
              <option value="2200">Tarima pesada (2,200 kg @ 60 cm)</option>
              <option value="2500">Límite Nominal (2,500 kg @ 60 cm)</option>
              <option value="3200">Sobrecarga de riesgo (3,200 kg @ 60 cm)</option>
              <option value="custom">✏️ Personalizar (Manual)...</option>
            </select>
            {loadOption === 'custom' && (
              <div
                id="customLoadBox"
                className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200"
              >
                <div>
                  <span className="text-[10px] text-slate-600 block">Carga (kg):</span>
                  <input
                    type="number"
                    id="inpCustLoadKg"
                    value={loadWeight}
                    min="0"
                    max="15000"
                    onChange={(e) =>
                      setLoadWeight(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="w-full text-xs font-mono-num border border-slate-300 rounded p-1.5 bg-white touch-manipulation"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-600 block">Centro L (cm):</span>
                  <input
                    type="number"
                    id="inpCustLoadCenter"
                    value={loadCenter}
                    min="10"
                    max="200"
                    onChange={(e) =>
                      setLoadCenter(Math.max(10, parseFloat(e.target.value) || 0))
                    }
                    className="w-full text-xs font-mono-num border border-slate-300 rounded p-1.5 bg-white touch-manipulation"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. ALTURA DE ELEVACIÓN */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="selHeight"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-700"
              >
                3. Altura Mástil
              </label>
              <span
                id="badgeHeight"
                className="text-[10px] font-mono-num text-slate-600 font-semibold"
              >
                {mastHeight.toFixed(1)} m
              </span>
            </div>
            <select
              id="selHeight"
              value={heightOption}
              onChange={(e) => handleHeightChange(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-lime-500 focus:outline-none text-slate-800 cursor-pointer touch-manipulation"
            >
              <option value="0.2">Piso / Traslado seguro (0.2 m)</option>
              <option value="1.5">Media altura (1.5 m)</option>
              <option value="2.5">Nivel Rack Estándar (2.5 m)</option>
              <option value="4.0">Altura Máxima (4.0 m)</option>
              <option value="custom">✏️ Personalizar (Manual)...</option>
            </select>
            {heightOption === 'custom' && (
              <div
                id="customHeightBox"
                className="mt-2 pt-2 border-t border-slate-200"
              >
                <span className="text-[10px] text-slate-600 block">
                  Altura de elevación (metros):
                </span>
                <input
                  type="number"
                  id="inpCustHeight"
                  value={mastHeight}
                  min="0.1"
                  max="8.0"
                  step="0.1"
                  onChange={(e) =>
                    setMastHeight(Math.max(0.1, parseFloat(e.target.value) || 0))
                  }
                  className="w-full text-xs font-mono-num border border-slate-300 rounded p-1.5 bg-white touch-manipulation"
                />
              </div>
            )}
          </div>

          {/* 4. INCLINACIÓN DEL MÁSTIL */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="selTilt"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-700"
              >
                4. Inclinación Mástil
              </label>
              <span
                id="badgeTilt"
                className="text-[10px] font-mono-num text-slate-600 font-semibold"
              >
                {tiltAngle}°
              </span>
            </div>
            <select
              id="selTilt"
              value={tiltOption}
              onChange={(e) => handleTiltChange(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-lime-500 focus:outline-none text-slate-800 cursor-pointer touch-manipulation"
            >
              <option value="-4">Inclinado atrás (-4°) [Óptimo]</option>
              <option value="0">Vertical (0°)</option>
              <option value="4">Inclinado al frente (+4°) [Peligro]</option>
              <option value="8">Máxima inclinación frente (+8°)</option>
              <option value="custom">✏️ Personalizar (Manual)...</option>
            </select>
            {tiltOption === 'custom' && (
              <div
                id="customTiltBox"
                className="mt-2 pt-2 border-t border-slate-200"
              >
                <span className="text-[10px] text-slate-600 block">
                  Grados (-6° atrás a +12° frente):
                </span>
                <input
                  type="number"
                  id="inpCustTilt"
                  value={tiltAngle}
                  min="-6"
                  max="12"
                  step="1"
                  onChange={(e) => setTiltAngle(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-mono-num border border-slate-300 rounded p-1.5 bg-white touch-manipulation"
                />
              </div>
            )}
          </div>

          {/* 5. VELOCIDAD Y FRENADO */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="selSpeed"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-700"
              >
                5. Velocidad (km/h)
              </label>
              <span
                id="badgeSpeed"
                className="text-[10px] font-mono-num text-slate-600 font-semibold"
              >
                {speedKmh === 0
                  ? '0 km/h (Parado)'
                  : `${speedKmh} km/h (${deceleration} m/s²)`}
              </span>
            </div>
            <select
              id="selSpeed"
              value={speedOption}
              onChange={(e) => handleSpeedChange(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-lime-500 focus:outline-none text-slate-800 cursor-pointer touch-manipulation"
            >
              <option value="0">🛑 Detenido / Estático (0 km/h)</option>
              <option value="5">🐢 Maniobra lenta (5 km/h)</option>
              <option value="10">🚜 Velocidad de pasillo (10 km/h)</option>
              <option value="15">⚠️ Velocidad máxima (15 km/h)</option>
              <option value="panic_10">🚨 Frenado brusco a 10 km/h</option>
              <option value="custom">✏️ Personalizar (Manual km/h)...</option>
            </select>
            {speedOption === 'custom' && (
              <div
                id="customSpeedBox"
                className="mt-2 pt-2 border-t border-slate-200"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-600 block">Velocidad:</span>
                    <input
                      type="number"
                      id="inpCustSpeed"
                      value={speedKmh}
                      min="0"
                      max="30"
                      step="1"
                      onChange={(e) =>
                        handleCustomSpeedInput(
                          Math.max(0, parseFloat(e.target.value) || 0),
                          custBrakeType
                        )
                      }
                      className="w-full text-xs font-mono-num border border-slate-300 rounded p-1.5 bg-white touch-manipulation"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 block">Frenado:</span>
                    <select
                      id="selCustBrakeType"
                      value={custBrakeType}
                      onChange={(e) => {
                        const bt = e.target.value;
                        setCustBrakeType(bt);
                        handleCustomSpeedInput(speedKmh, bt);
                      }}
                      className="w-full text-xs font-semibold border border-slate-300 rounded p-1.5 bg-white cursor-pointer touch-manipulation"
                    >
                      <option value="normal">Normal (1.8 m/s²)</option>
                      <option value="panic">Pánico (3.8 m/s²)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
