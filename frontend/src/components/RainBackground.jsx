import React, { useEffect, useRef } from 'react';

export default function RainBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let raindrops = [];
    let splashes = [];
    let mouse = { x: -1000, y: -1000 };
    const umbrellaRadius = 70; // Radius of the "hard surface" collision around the mouse

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resize);
    resize();

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    class Raindrop {
      constructor() {
        this.reset(true);
      }
      
      reset(randomY = false) {
        this.x = Math.random() * canvas.width;
        this.y = randomY ? Math.random() * canvas.height : -20;
        this.length = Math.random() * 20 + 15;
        this.speed = Math.random() * 12 + 8;
        this.opacity = Math.random() * 0.4 + 0.1;
        this.angle = 0.05; // Slight wind angle
      }
      
      update() {
        this.y += this.speed;
        this.x += this.speed * this.angle;
        
        // Collision with mouse
        const dx = this.x - mouse.x;
        const dy = (this.y + this.length) - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If raindrop is inside umbrella radius and above the exact center of mouse
        if (distance < umbrellaRadius && this.y < mouse.y) {
          // Spawn scattering splash particles exactly at the collision point
          const numParticles = Math.floor(Math.random() * 3) + 3; // 3 to 5 particles
          for (let i = 0; i < numParticles; i++) {
            splashes.push(new SplashParticle(this.x, this.y + this.length));
          }
          this.reset();
        } else if (this.y > canvas.height || this.x > canvas.width) {
          this.reset();
        }
      }
      
      draw() {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.length * this.angle, this.y + this.length);
        ctx.strokeStyle = `rgba(160, 190, 255, ${this.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    class SplashParticle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 6; // Scatter left/right
        this.vy = -(Math.random() * 4 + 2); // Bounce up
        this.gravity = 0.3; // Pull back down
        this.radius = Math.random() * 1.5 + 0.5;
        this.opacity = 0.8;
      }
      
      update() {
        this.vy += this.gravity; // Apply gravity
        this.x += this.vx;
        this.y += this.vy;
        this.opacity -= 0.02; // Fade out
      }
      
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 230, 255, ${this.opacity})`;
        ctx.fill();
      }
    }

    // Calculate raindrops based on screen width for consistent density (approx 1 drop per 5px width)
    const dropCount = Math.floor(canvas.width / 5);
    for (let i = 0; i < dropCount; i++) {
      raindrops.push(new Raindrop());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw drops
      raindrops.forEach(drop => {
        drop.update();
        drop.draw();
      });
      
      // Update and draw splash particles
      for (let i = splashes.length - 1; i >= 0; i--) {
        splashes[i].update();
        splashes[i].draw();
        
        if (splashes[i].opacity <= 0) {
          splashes.splice(i, 1);
        }
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
}
