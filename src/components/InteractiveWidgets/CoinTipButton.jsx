import React, { useRef, useEffect, useState } from 'react';
import './CoinTipButton.css';

/**
 * 3D硬币打赏按钮组件
 * 实现硬币投掷动画效果
 */
const CoinTipButton = ({ 
  onTip, 
  buttonText = '留下你的小费',
  className = '',
  disabled = false 
}) => {
  const buttonRef = useRef(null);
  const coinRef = useRef(null);
  const [isTipping, setIsTipping] = useState(false);
  
  // 动态加载GSAP库
  useEffect(() => {
    let gsapModule = null;
    let physics2DModule = null;

    const loadGSAP = async () => {
      try {
        // 动态导入GSAP (需要项目中安装gsap包)
        const gsap = await import('gsap');
        const { Physics2DPlugin } = await import('gsap/Physics2DPlugin');
        
        gsapModule = gsap.default || gsap;
        physics2DModule = Physics2DPlugin;
        
        gsapModule.registerPlugin(physics2DModule);
      } catch (error) {
        console.warn('GSAP not available, using fallback animation');
        // 可以在这里实现fallback动画
      }
    };

    loadGSAP();
  }, []);

  // 硬币投掷动画
  const handleTip = async () => {
    if (isTipping || disabled) return;
    
    const button = buttonRef.current;
    const coin = coinRef.current;
    
    if (!button || !coin) return;

    setIsTipping(true);
    
    try {
      // 尝试使用GSAP动画
      const gsap = await import('gsap').then(m => m.default || m);
      const { Physics2DPlugin } = await import('gsap/Physics2DPlugin');
      
      gsap.registerPlugin(Physics2DPlugin);

      const currentRotation = gsap.getProperty(button, 'rotate') || 0;
      if (currentRotation < 0) {
        document.documentElement.dataset.flipped = 'true';
      }

      const rotation = Math.abs(currentRotation);
      const duration = gsap.utils.mapRange(0, 15, 0, 0.6)(rotation);
      const distance = gsap.utils.snap(1, gsap.utils.mapRange(0, 15, 100, 350)(rotation));
      const velocity = gsap.utils.mapRange(0, 15, 300, 700)(rotation);
      const bounce = gsap.utils.mapRange(300, 700, 2, 12)(Math.abs(velocity));
      const distanceDuration = gsap.utils.mapRange(100, 350, 0.25, 0.6)(distance);
      const spin = gsap.utils.snap(1, gsap.utils.mapRange(100, 350, 1, 6)(distance));
      const offRotate = gsap.utils.random(0, 90, 1) * -1;
      const hangtime = Math.max(1, duration * 4);

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(coin, { yPercent: 100 });

          gsap.timeline({
            onComplete: () => {
              gsap.set(button, { clearProps: 'all' });
              gsap.set(coin, { clearProps: 'all' });
              gsap.set('.coin-purse', { clearProps: 'all' });
              setIsTipping(false);
              
              // 调用外部回调
              if (onTip) {
                onTip();
              }
            }
          })
            .to(button, {
              yPercent: bounce,
              repeat: 1,
              duration: 0.12,
              yoyo: true
            })
            .fromTo('.coin-hole', { scale: 1 }, {
              scale: 0,
              duration: 0.2,
              delay: 0.2
            })
            .set(coin, { clearProps: 'all' })
            .set(coin, { yPercent: -50 })
            .fromTo('.coin-purse', { xPercent: -200 }, {
              delay: 0.5,
              xPercent: 0,
              duration: 0.5,
              ease: 'power1.out'
            })
            .fromTo(coin, { rotate: -460 }, {
              rotate: 0,
              duration: 0.5,
              ease: 'power1.out'
            }, '<')
            .timeScale(1.1);
        }
      })
        .set(button, { transition: 'none' })
        .fromTo(button, { rotate: currentRotation }, {
          rotate: 0,
          duration,
          ease: 'elastic.out(1.75,0.75)'
        })
        .to(coin, {
          onUpdate: function () {
            const y = gsap.getProperty(coin, 'y');
            if (y >= coin.offsetHeight) {
              this.progress(1);
              tl.progress(1);
            }
          },
          duration: hangtime,
          physics2D: { velocity, angle: -90, gravity: 1000 }
        }, `>-${duration * 0.825}`)
        .fromTo(coin, { rotateX: 0 }, {
          duration: distanceDuration * 2,
          rotateX: spin * -360
        }, '<')
        .to(coin, { rotateY: offRotate, duration: distanceDuration }, '<')
        .to(coin, { '--rx': offRotate, duration: distanceDuration }, '<')
        .fromTo('.coin-hole', { scale: 0 }, { scale: 1, duration: 0.2 }, hangtime * 0.35)
        .timeScale(1.1);

    } catch (error) {
      // Fallback animation without GSAP
      console.warn('Using fallback animation');
      
      button.style.transition = 'transform 0.3s ease';
      button.style.transform = 'rotate(-15deg)';
      
      setTimeout(() => {
        button.style.transform = 'rotate(0deg)';
        
        setTimeout(() => {
          setIsTipping(false);
          if (onTip) {
            onTip();
          }
        }, 300);
      }, 200);
    }
  };

  return (
    <div className={`coin-tip-container ${className}`}>
      <button 
        ref={buttonRef}
        className="coin-tip-button"
        data-tipping={isTipping}
        onClick={handleTip}
        disabled={disabled || isTipping}
        aria-label="投掷硬币打赏"
      >
        <span className="coin-button-content">
          <span className="coin-scene">
            <span className="coin-hole"></span>
            <span className="coin-purse">
              <span className="coin" ref={coinRef}>
                <span className="coin__face coin__face--front">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path 
                      d="M12 2L13.5 8H20L15 12L17 18L12 15L7 18L9 12L4 8H10.5L12 2Z" 
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <span className="coin__core"></span>
                <span className="coin__core coin__core--rotated"></span>
                <span className="coin__face coin__face--rear">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path 
                      d="M12 2L13.5 8H20L15 12L17 18L12 15L7 18L9 12L4 8H10.5L12 2Z" 
                      fill="currentColor"
                    />
                  </svg>
                </span>
              </span>
            </span>
          </span>
          <span className="coin-button-text">{buttonText}</span>
        </span>
      </button>
    </div>
  );
};

export default CoinTipButton;