import { SimulationEngine } from './src/simulator.js';
import path from 'path';
const sim = new SimulationEngine(null);
sim.loadSession('../Conversaciones ejemplo/29081f31-6f31-43f8-96d6-8ea576052c5f', 'test-session').then(() => {
  console.log('Total events:', sim.eventsQueue.length);
  const dbaEvents = sim.eventsQueue.filter(e => e.agentRole === 'dba' || e.agentRole === 'experto en bases de datos y arquitectura');
  console.log('DBA events:', dbaEvents.length);
  if (dbaEvents.length > 0) {
     console.log('First DBA event:', dbaEvents[0]);
  }
});
