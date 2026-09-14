/**
 * Unit tests for MascotSystem badge state transitions
 */

describe('MascotSystem badge transitions', () => {
  test('thinking badge should pulse when working', () => {
    const mascot = MascotSystem.createMascot({ agentId: 'test' });
    MascotSystem.setState(mascot, 'working');
    
    const badge = mascot.querySelector('.status-badge');
    expect(badge.classList.contains('badge-thinking')).toBe(true);
  });
  
  test('asking badge should show light bulb', () => {
    const mascot = MascotSystem.createMascot({ agentId: 'test' });
    MascotSystem.setState(mascot, 'awaiting-approval');
    
    const badge = mascot.querySelector('.status-badge');
    expect(badge.classList.contains('badge-asking')).toBe(true);
  });
  
  test('done badge should show checkmark', () => {
    const mascot = MascotSystem.createMascot({ agentId: 'test' });
    MascotSystem.setState(mascot, 'done');
    
    const badge = mascot.querySelector('.status-badge');
    expect(badge.classList.contains('badge-done')).toBe(true);
  });
  
  test('idle state should have no badge class', () => {
    const mascot = MascotSystem.createMascot({ agentId: 'test' });
    MascotSystem.setState(mascot, 'idle');
    
    const badge = mascot.querySelector('.status-badge');
    expect(badge.className).toBe('status-badge');
  });
});
