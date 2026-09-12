import React, { useState, useRef, useEffect } from 'react';

// 阻止双指缩放
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());

// 阻止鼠标右键菜单（以防万一）
document.addEventListener('contextmenu', (e) => e.preventDefault());


function App() {
  const [currentMode, setCurrentMode] = useState('');
  const [chances, setChances] = useState(3);
  const [targetTime, setTargetTime] = useState({ hour: 12, minute: 0, second: 0 });
  const [currentTime, setCurrentTime] = useState({ hour: 12, minute: 0, second: 0 });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedHand, setDraggedHand] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [longPressHand, setLongPressHand] = useState(null);
  const [longPressDirection, setLongPressDirection] = useState(null);
  const [longPressSpeed, setLongPressSpeed] = useState(0);
  
  const clockFaceRef = useRef(null);
  const [clockSize, setClockSize] = useState(380);
  
  // 用 ref 同步追踪拖动状态（避免 useCallback 闭包读到旧值）
  const isDraggingRef = useRef(false);
  const draggedHandRef = useRef(null);
  
  useEffect(() => {
    const updateClockSize = () => {
      const width = window.innerWidth;
      if (width <= 480) {
        setClockSize(280);
      } else if (width <= 768) {
        setClockSize(320);
      } else {
        setClockSize(380);
      }
    };
    
    updateClockSize();
    window.addEventListener('resize', updateClockSize);
    
    return () => {
      window.removeEventListener('resize', updateClockSize);
    };
  }, []);

  // 实时时间更新定时器
  const realtimeTimerRef = useRef(null);

  const updateRealTime = () => {
    const now = new Date();
    const hours = now.getHours() % 12 || 12; // 转换为12小时制，0点转换为12
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    setCurrentTime({ hour: hours, minute: minutes, second: seconds });
  };

  const startMode = (mode) => {
    setCurrentMode(mode);
    if (mode !== 'learn') {
      setChances(3);
    }
    setMessage('');
    setMessageType('');
    
    // 清除之前可能存在的实时时间定时器
    if (realtimeTimerRef.current) {
      clearInterval(realtimeTimerRef.current);
      realtimeTimerRef.current = null;
    }
    
    if (mode === 'read') {
      const targetHour = Math.floor(Math.random() * 12) + 1;
      const targetMinute = Math.floor(Math.random() * 60);
      setTargetTime({ hour: targetHour, minute: targetMinute, second: 0 });
      setCurrentTime({ hour: 0, minute: 0, second: 0 });
    } else if (mode === 'set') {
      const targetHour = Math.floor(Math.random() * 12) + 1;
      const targetMinute = Math.floor(Math.random() * 60);
      setTargetTime({ hour: targetHour, minute: targetMinute, second: 0 });
      const randomHour = Math.floor(Math.random() * 12) + 1;
      const randomMinute = Math.floor(Math.random() * 60);
      setCurrentTime({ hour: randomHour, minute: randomMinute, second: 0 });
    } else if (mode === 'learn') {
      setCurrentTime({ hour: 12, minute: 0, second: 0 });
    } else if (mode === 'realtime') {
      // 立即更新一次时间
      updateRealTime();
      // 设置定时器，每秒更新一次时间
      realtimeTimerRef.current = setInterval(updateRealTime, 1000);
    }
  };

  const backToEntry = () => {
    setCurrentMode('');
    // 清除实时时间定时器
    if (realtimeTimerRef.current) {
      clearInterval(realtimeTimerRef.current);
      realtimeTimerRef.current = null;
    }
  };

  const renderNumbers = () => {
    const numbers = [];
    for (let i = 1; i <= 12; i++) {
      const angle = (i * 30) * (Math.PI / 180);
      const radius = clockSize / 2 - 35;
      const x = Math.sin(angle) * radius;
      const y = -Math.cos(angle) * radius;

      numbers.push(
        <div
          key={i}
          className="clock-number"
          style={{
            left: `calc(50% + ${x}px - 16px)`,
            top: `calc(50% + ${y}px - 16px)`,
          }}
        >
          {i}
        </div>
      );
    }
    return numbers;
  };

  const renderTicks = () => {
    const ticks = [];
    for (let i = 0; i < 60; i++) {
      const isHour = i % 5 === 0;
      const rotation = i * 6;
      
      ticks.push(
        <div
          key={i}
          className={`clock-tick ${isHour ? 'hour-tick' : 'minute-tick'}`}
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      );
    }
    return ticks;
  };

  const getAngleFromPosition = (clientX, clientY) => {
    const rect = clockFaceRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90;
    const normalizedAngle = angle < 0 ? angle + 360 : angle;
    return normalizedAngle;
  };

  // 计算两角度间的最小夹角（0-180）
  const angleDiff = (a, b) => {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
  };

  // 表盘级 pointerdown：智能锁定最接近的指针
  const handlePointerDown = (e) => {
    if (currentMode === 'read' || currentMode === 'realtime') return;
    if (!clockFaceRef.current) return;

    e.preventDefault();
    const touchAngle = getAngleFromPosition(e.clientX, e.clientY);

    // 当前指针角度（非 read/realtime 模式下 displayTime === currentTime）
    const hDeg = (((currentTime.hour || 0) % 12 + (currentTime.minute || 0) / 60) / 12) * 360;
    const mDeg = (((currentTime.minute || 0) + (currentTime.second || 0) / 60) / 60) * 360;
    const sDeg = ((currentTime.second || 0) / 60) * 360;

    // 计算每根针与触点的角度差
    const diffs = [
      { hand: 'hour', diff: angleDiff(touchAngle, hDeg) },
      { hand: 'minute', diff: angleDiff(touchAngle, mDeg) },
    ];
    if (currentMode === 'learn') {
      diffs.push({ hand: 'second', diff: angleDiff(touchAngle, sDeg) });
    }

    // 锁定最接近的那根
    diffs.sort((a, b) => a.diff - b.diff);
    const pickedHand = diffs[0].hand;
    
    // 同时更新 ref（同步）和 state（触发重渲染）
    draggedHandRef.current = pickedHand;
    isDraggingRef.current = true;
    setDraggedHand(pickedHand);
    setIsDragging(true);

    // 捕获 pointer，即使手指滑出表盘也持续接收
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) { /* 某些浏览器不支持 */ }
  };

  // 统一的角度→时间更新逻辑（复用）
  const updateTimeByAngle = (hand, currentAngle) => {
    let newTime = { ...currentTime };

    if (hand === 'second') {
      const angleSeconds = Math.round(currentAngle / 6) % 60;
      const normalized = angleSeconds < 0 ? angleSeconds + 60 : angleSeconds;
      let secondDiff = normalized - currentTime.second;
      if (secondDiff > 30) secondDiff -= 60;
      else if (secondDiff < -30) secondDiff += 60;

      let newSeconds = currentTime.second + secondDiff;
      let newMinutes = currentTime.minute;
      let newHours = currentTime.hour;

      if (newSeconds >= 60) { newMinutes += Math.floor(newSeconds / 60); newSeconds = newSeconds % 60; }
      else if (newSeconds < 0) { newMinutes += Math.floor(newSeconds / 60); newSeconds = newSeconds % 60 + 60; }
      if (newMinutes >= 60) { newHours += Math.floor(newMinutes / 60); newMinutes = newMinutes % 60; }
      else if (newMinutes < 0) { newHours += Math.floor(newMinutes / 60); newMinutes = newMinutes % 60 + 60; }
      newHours = ((newHours - 1) % 12 + 12) % 12 + 1;

      newTime = { hour: newHours, minute: newMinutes, second: newSeconds };

    } else if (hand === 'minute') {
      const angleMinutes = Math.round(currentAngle / 6) % 60;
      const normalized = angleMinutes < 0 ? angleMinutes + 60 : angleMinutes;
      let minuteDiff = normalized - currentTime.minute;
      if (minuteDiff > 30) minuteDiff -= 60;
      else if (minuteDiff < -30) minuteDiff += 60;

      let newMinutes = currentTime.minute + minuteDiff;
      let newHours = currentTime.hour;

      if (newMinutes >= 60) { newHours += Math.floor(newMinutes / 60); newMinutes = newMinutes % 60; }
      else if (newMinutes < 0) { newHours += Math.floor(newMinutes / 60); newMinutes = newMinutes % 60 + 60; }
      newHours = ((newHours - 1) % 12 + 12) % 12 + 1;

      newTime = { hour: newHours, minute: newMinutes, second: currentTime.second };

    } else if (hand === 'hour') {
      const angleHours = Math.round(currentAngle / 30) % 12;
      const normalized = angleHours < 0 ? angleHours + 12 : angleHours;
      const targetHour = normalized === 0 ? 12 : normalized;

      let hourDiff = targetHour - currentTime.hour;
      if (hourDiff > 6) hourDiff -= 12;
      else if (hourDiff < -6) hourDiff += 12;

      let newHours = currentTime.hour + hourDiff;
      newHours = ((newHours - 1) % 12 + 12) % 12 + 1;

      newTime = { hour: newHours, minute: currentTime.minute, second: currentTime.second };
    }

    return newTime;
  };

  // pointermove：拖动中更新时间（用 ref 读最新状态）
  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || !draggedHandRef.current || !clockFaceRef.current) return;

    e.preventDefault();
    const currentAngle = getAngleFromPosition(e.clientX, e.clientY);
    setCurrentTime(updateTimeByAngle(draggedHandRef.current, currentAngle));
  };

  // pointerup：停止拖动
  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    
    isDraggingRef.current = false;
    draggedHandRef.current = null;
    setIsDragging(false);
    setDraggedHand(null);
    
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  };

  const adjustHand = (hand, direction) => {
    let newTime = { ...currentTime };
    
    if (hand === 'second') {
      // 秒针调整，每次1秒
      let newSeconds = currentTime.second + (direction === 'clockwise' ? 1 : -1);
      let newMinutes = currentTime.minute;
      let newHours = currentTime.hour;
      
      // 处理秒针进位
      if (newSeconds >= 60) {
        newMinutes += Math.floor(newSeconds / 60);
        newSeconds = newSeconds % 60;
      } else if (newSeconds < 0) {
        newMinutes += Math.floor(newSeconds / 60);
        newSeconds = newSeconds % 60 + 60;
      }
      
      // 处理分针进位
      if (newMinutes >= 60) {
        newHours += Math.floor(newMinutes / 60);
        newMinutes = newMinutes % 60;
      } else if (newMinutes < 0) {
        newHours += Math.floor(newMinutes / 60);
        newMinutes = newMinutes % 60 + 60;
      }
      
      // 处理时针进位
      newHours = ((newHours - 1) % 12 + 12) % 12 + 1;
      
      newTime = {
        hour: newHours,
        minute: newMinutes,
        second: newSeconds
      };
      
    } else if (hand === 'minute') {
      // 分针调整，每次1分钟
      let newMinutes = currentTime.minute + (direction === 'clockwise' ? 1 : -1);
      let newHours = currentTime.hour;
      
      // 处理分针进位
      if (newMinutes >= 60) {
        newHours += Math.floor(newMinutes / 60);
        newMinutes = newMinutes % 60;
      } else if (newMinutes < 0) {
        newHours += Math.floor(newMinutes / 60);
        newMinutes = newMinutes % 60 + 60;
      }
      
      // 处理时针进位
      newHours = ((newHours - 1) % 12 + 12) % 12 + 1;
      
      newTime = {
        hour: newHours,
        minute: newMinutes,
        second: currentTime.second
      };
      
    } else if (hand === 'hour') {
      // 时针调整，每次1小时
      let newHours = currentTime.hour + (direction === 'clockwise' ? 1 : -1);
      
      // 处理时针进位
      newHours = ((newHours - 1) % 12 + 12) % 12 + 1;
      
      newTime = {
        hour: newHours,
        minute: currentTime.minute,
        second: currentTime.second
      };
    }
    
    setCurrentTime(newTime);
  };

  const handleButtonPress = (hand, direction) => {
    // 立即执行一次调整
    adjustHand(hand, direction);
    
    // 清除之前可能存在的定时器
    if (longPressTimer) {
      clearInterval(longPressTimer);
    }
    
    // 设置长按定时器，使用简单的加速逻辑
    let interval = 300; // 初始间隔300ms
    
    const timer = setInterval(() => {
      adjustHand(hand, direction);
    }, interval);
    
    setLongPressTimer(timer);
    setLongPressHand(hand);
    setLongPressDirection(direction);
  };

  const stopLongPress = () => {
    if (longPressTimer) {
      clearInterval(longPressTimer);
      setLongPressTimer(null);
      setLongPressHand(null);
      setLongPressDirection(null);
      setLongPressSpeed(0);
    }
  };

  const updateTime = (field, value) => {
    if (currentMode === 'set') return;
    
    let parsedValue;
    if (value === '' || value === null || value === undefined) {
      parsedValue = '';
    } else {
      parsedValue = parseInt(value);
      if (isNaN(parsedValue)) {
        parsedValue = '';
      }
    }
    
    const newTime = { ...currentTime, [field]: parsedValue };
    setCurrentTime(newTime);
  };

  const checkAnswer = () => {
    if (currentMode === 'read') {
      const userHour = currentTime.hour === '' ? 0 : parseInt(currentTime.hour);
      const userMinute = currentTime.minute === '' ? 0 : parseInt(currentTime.minute);
      
      if (userHour === targetTime.hour && userMinute === targetTime.minute) {
        setMessage('正确！');
        setMessageType('success');
        setTimeout(() => {
          const targetHour = Math.floor(Math.random() * 12) + 1;
          const targetMinute = Math.floor(Math.random() * 60);
          setTargetTime({ hour: targetHour, minute: targetMinute, second: 0 });
          setCurrentTime({ hour: 0, minute: 0, second: 0 });
          setMessage('');
          setMessageType('');
        }, 2000); // 延长显示时间
      } else {
        setChances(prev => prev - 1);
        // 显示正确的指针位置
        setCurrentTime({ ...targetTime, second: 0 });
        setMessage(`错误！正确时间是 ${targetTime.hour.toString().padStart(2, '0')}:${targetTime.minute.toString().padStart(2, '0')}`);
        setMessageType('error');
        if (chances <= 1) {
          setMessage('机会用完了！返回主界面');
          setMessageType('error');
          setTimeout(backToEntry, 3000); // 延长显示时间
        } else {
          setTimeout(() => {
            const targetHour = Math.floor(Math.random() * 12) + 1;
            const targetMinute = Math.floor(Math.random() * 60);
            setTargetTime({ hour: targetHour, minute: targetMinute, second: 0 });
            setCurrentTime({ hour: 0, minute: 0, second: 0 });
            setMessage('');
            setMessageType('');
          }, 3000); // 延长显示时间
        }
      }
    } else if (currentMode === 'set') {
      const displayHour = currentTime.hour === '' ? 0 : parseInt(currentTime.hour);
      const displayMinute = currentTime.minute === '' ? 0 : parseInt(currentTime.minute);
      
      if (Math.abs(displayHour - targetTime.hour) < 0.5 && 
          Math.abs(displayMinute - targetTime.minute) < 1) {
        setMessage('正确！');
        setMessageType('success');
        setTimeout(() => {
          const targetHour = Math.floor(Math.random() * 12) + 1;
          const targetMinute = Math.floor(Math.random() * 60);
          setTargetTime({ hour: targetHour, minute: targetMinute, second: 0 });
          const randomHour = Math.floor(Math.random() * 12) + 1;
          const randomMinute = Math.floor(Math.random() * 60);
          setCurrentTime({ hour: randomHour, minute: randomMinute, second: 0 });
          setMessage('');
          setMessageType('');
        }, 2000); // 延长显示时间
      } else {
        setChances(prev => prev - 1);
        // 显示指针所指的数值
        setMessage(`错误！指针所指时间是 ${displayHour.toString().padStart(2, '0')}:${displayMinute.toString().padStart(2, '0')}`);
        setMessageType('error');
        if (chances <= 1) {
          setMessage('机会用完了！返回主界面');
          setMessageType('error');
          setTimeout(backToEntry, 3000); // 延长显示时间
        } else {
          setTimeout(() => {
            const targetHour = Math.floor(Math.random() * 12) + 1;
            const targetMinute = Math.floor(Math.random() * 60);
            setTargetTime({ hour: targetHour, minute: targetMinute, second: 0 });
            const randomHour = Math.floor(Math.random() * 12) + 1;
            const randomMinute = Math.floor(Math.random() * 60);
            setCurrentTime({ hour: randomHour, minute: randomMinute, second: 0 });
            setMessage('');
            setMessageType('');
          }, 3000); // 延长显示时间
        }
      }
    }
  };

  const displayTime = currentMode === 'read' ? targetTime : currentTime;
  const secondDegrees = ((displayTime.second || 0) / 60) * 360;
  const minuteDegrees = (((displayTime.minute || 0) + (displayTime.second || 0) / 60) / 60) * 360;
  const hourDegrees = (((displayTime.hour || 0) % 12 + (displayTime.minute || 0) / 60) / 12) * 360;
  
  const inputTime = currentMode === 'set' ? targetTime : currentTime;

  if (!currentMode) {
    return (
      <div id="entry-page" className="container">
        <h1>公鸡打鸣</h1>
        <div className="mode-buttons">
          <button className="mode-btn" onClick={() => startMode('read')} onTouchStart={() => startMode('read')}>读指针模式</button>
          <button className="mode-btn" onClick={() => startMode('set')} onTouchStart={() => startMode('set')}>拨指针模式</button>
          <button className="mode-btn" onClick={() => startMode('learn')} onTouchStart={() => startMode('learn')}>认表模式</button>
          <button className="mode-btn" onClick={() => startMode('realtime')} onTouchStart={() => startMode('realtime')}>实时钟表模式</button>
        </div>
        <a className="home-link" href="/">← 返回 Rainlet 首页</a>
      </div>
    );
  }

  return (
    <div id="clock-page" className="container clock-container">
      <h2 id="mode-title">
        {currentMode === 'read' ? '读指针模式' : 
         currentMode === 'set' ? '拨指针模式' : 
         currentMode === 'realtime' ? '实时钟表模式' : '认表模式'}
      </h2>
      
      <div 
        className="clock-face" 
        ref={clockFaceRef} 
        style={{ width: `${clockSize}px`, height: `${clockSize}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="clock-inner-ring" />
        {renderTicks()}
        {renderNumbers()}
        
        <div 
          className="clock-hand hour-hand" 
          id="hour-hand"
          style={{ transform: `rotate(${hourDegrees}deg)` }}
        />
        
        <div 
          className="clock-hand minute-hand" 
          id="minute-hand"
          style={{ transform: `rotate(${minuteDegrees}deg)` }}
        />
        
        {currentMode !== 'read' && currentMode !== 'set' && (
          <div 
            className="clock-hand second-hand" 
            id="second-hand"
            style={{ transform: `rotate(${secondDegrees}deg)` }}
          />
        )}
        
        <div className="clock-center"></div>
        {/* 拖动时的视觉提示（小十字） */}
        {isDragging && draggedHand && (
          <div className="drag-indicator" />
        )}
      </div>
      
      {/* 指针控制按键 */}
      {(currentMode === 'set' || currentMode === 'learn') && (
        <div className="hand-controls">
          {currentMode === 'set' && (
            <>
              <div className="control-group">
                <button 
                  className="control-btn" 
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonPress('hour', 'clockwise');
                  }}
                  onPointerUp={stopLongPress}
                  onPointerLeave={stopLongPress}
                >时针（小针）-顺</button>
                <button 
                  className="control-btn" 
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonPress('hour', 'counterclockwise');
                  }}
                  onPointerUp={stopLongPress}
                  onPointerLeave={stopLongPress}
                >时针（小针）-逆</button>
              </div>
              <div className="control-group">
                <button 
                  className="control-btn" 
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonPress('minute', 'clockwise');
                  }}
                  onPointerUp={stopLongPress}
                  onPointerLeave={stopLongPress}
                >分针（大针）-顺</button>
                <button 
                  className="control-btn" 
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonPress('minute', 'counterclockwise');
                  }}
                  onPointerUp={stopLongPress}
                  onPointerLeave={stopLongPress}
                >分针（大针）-逆</button>
              </div>
            </>
          )}
          {currentMode === 'learn' && (
            <>
              <div className="control-group">
                <button 
                  className="control-btn" 
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonPress('hour', 'clockwise');
                  }}
                  onPointerUp={stopLongPress}
                  onPointerLeave={stopLongPress}
                >时针（小针）-顺</button>
                <button 
                  className="control-btn" 
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonPress('hour', 'counterclockwise');
                  }}
                  onPointerUp={stopLongPress}
                  onPointerLeave={stopLongPress}
                >时针（小针）-逆</button>
              </div>
              <div className="control-group">
                <button 
                  className="control-btn" 
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonPress('minute', 'clockwise');
                  }}
                  onPointerUp={stopLongPress}
                  onPointerLeave={stopLongPress}
                >分针（大针）-顺</button>
                <button 
                  className="control-btn" 
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonPress('minute', 'counterclockwise');
                  }}
                  onPointerUp={stopLongPress}
                  onPointerLeave={stopLongPress}
                >分针（大针）-逆</button>
              </div>
              <div className="control-group">
                <button 
                  className="control-btn" 
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonPress('second', 'clockwise');
                  }}
                  onPointerUp={stopLongPress}
                  onPointerLeave={stopLongPress}
                >秒针-顺</button>
                <button 
                  className="control-btn" 
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleButtonPress('second', 'counterclockwise');
                  }}
                  onPointerUp={stopLongPress}
                  onPointerLeave={stopLongPress}
                >秒针-逆</button>
              </div>
            </>
          )}
        </div>
      )}
      
      {((currentMode !== 'read' && currentMode !== 'set') || currentMode === 'realtime') && (
        <div className="time-display" id="time-display">
          {displayTime.hour.toString().padStart(2, '0')}:
          {displayTime.minute.toString().padStart(2, '0')}
          <span>:
          {displayTime.second.toString().padStart(2, '0')}
          </span>
        </div>
      )}
      
      {currentMode !== 'realtime' && (
        <div className="time-inputs" id="time-inputs">
        <input 
          type="text" 
          className="time-input" 
          id="hour-input" 
          value={inputTime.hour}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 12)) {
              updateTime('hour', val);
            }
          }}
          disabled={currentMode === 'set'}
        />
        <span>时</span>
        <input 
          type="text" 
          className="time-input" 
          id="minute-input" 
          value={inputTime.minute}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
              updateTime('minute', val);
            }
          }}
          disabled={currentMode === 'set'}
        />
        <span>分</span>
        {currentMode !== 'read' && currentMode !== 'set' && (
          <>
            <input 
              type="text" 
              className="time-input" 
              id="second-input" 
              value={currentTime.second}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                  updateTime('second', val);
                }
              }}
              disabled={currentMode === 'set'}
            />
            <span>秒</span>
   </>
        )}
        </div>
      )}
      
      {currentMode !== 'learn' && currentMode !== 'realtime' && (
        <div className="chances" id="chances">剩余机会：{chances}</div>
      )}
      {message && (
        <div className={`message ${messageType}`} id="message">{message}</div>
      )}
      
      {(currentMode === 'read' || currentMode === 'set') && currentMode !== 'realtime' && (
        <button className="confirm-btn" id="confirm-btn" onClick={checkAnswer} onTouchStart={checkAnswer}>确认</button>
      )}
      <button className="back-btn" onClick={backToEntry} onTouchStart={backToEntry}>返回</button>
    </div>
  );
}

export default App;
