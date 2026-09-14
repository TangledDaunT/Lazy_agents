/**
 * Unit tests for MascotSystem.createMascot()
 */

describe('MascotSystem.createMascot', () => {
  beforeEach(() => {
    // Setup test DOM
    document.body.innerHTML = '<div id="test-container"></div>';
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  test('should create mascot div with correct id', () => {
    const mascot = MascotSystem.createMascot({
      agentId: 'test-agent'
    });
    
    expect(mascot.id).toBe('mascot-test-agent');
    expect(mascot.classList.contains('mascot')).toBe(true);
  });
  
  test('should apply default accent color', () => {
    const mascot = MascotSystem.createMascot({
      agentId: 'hermes'
    });
    
    const accentVar = mascot.style.getPropertyValue('--agent-color');
    expect(accentVar).toBe('#f5d061');
  });
  
  test('should create mascot image sprite', () => {
    const mascot = MascotSystem.createMascot({
      agentId: 'hermes',
      outfit: 'corporate'
    });
    
    const img = mascot.querySelector('.mascot-sprite');
    expect(img).not.toBeNull();
    expect(img.src).toContain('hermes-corporate.png');
  });
  
  test('should create status badge element', () => {
    const mascot = MascotSystem.createMascot({
      agentId: 'byte'
    });
    
    const badge = mascot.querySelector('.status-badge');
    expect(badge).not.toBeNull();
  });
  
  test('should set initial state class', () => {
    const mascot = MascotSystem.createMascot({
      agentId: 'ledger',
      state: 'working'
    });
    
    expect(mascot.classList.contains('working')).toBe(true);
  });
});

module.exports = { describe, test, expect, beforeEach, afterEach };
