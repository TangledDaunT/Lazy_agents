/**
 * CSS Animation verification tests
 */

describe('Badge CSS animations', () => {
  test('badge-thinking should have pulse animation', () => {
    const div = document.createElement('div');
    div.className = 'status-badge badge-thinking';
    document.body.appendChild(div);
    
    const styles = window.getComputedStyle(div);
    const animation = styles.animation;
    expect(animation).toContain('pulse-badge');
    
    document.body.removeChild(div);
  });
  
  test('badge-asking should display light bulb emoji', () => {
    const div = document.createElement('div');
    div.className = 'status-badge badge-asking';
    document.body.appendChild(div);
    
    const styles = window.getComputedStyle(div, '::after');
    expect(styles.content).toContain('💡');
    
    document.body.removeChild(div);
  });
  
  test('badge-done should use green color', () => {
    const div = document.createElement('div');
    div.className = 'status-badge badge-done';
    document.body.appendChild(div);
    
    const styles = window.getComputedStyle(div, '::after');
    expect(styles.color).toMatch(/rgb.*111.*251.*190/);
    
    document.body.removeChild(div);
  });
});
