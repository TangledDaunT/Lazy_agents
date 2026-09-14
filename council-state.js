/**
 * CouncilState - Manages agent council mode state
 */

const CouncilState = {
  active: false,
  previousStates: {},
  
  /**
   * Activate council mode for all agents
   */
  activate() {
    this.previousStates = {};
    
    Object.keys(MascotSystem.mascots).forEach(agentId => {
      this.previousStates[agentId] = MascotSystem.mascots[agentId].state;
    });
    
    this.active = true;
    return this.previousStates;
  },
  
  /**
   * Deactivate council mode and restore previous states
   */
  deactivate() {
    this.active = false;
    const states = { ...this.previousStates };
    this.previousStates = {};
    return states;
  },
  
  /**
   * Check if council is active
   */
  isActive() {
    return this.active;
  },
  
  /**
   * Get all participating agent IDs
   */
  getParticipants() {
    return Object.keys(MascotSystem.mascots);
  }
};

window.CouncilState = CouncilState;
