import WheelModule from './wheel/WheelModule.vue';
import CircleModule from './circle/CircleModule.vue';

export const modules = [
  {
    id: 'wheel',
    name: 'Wheel',
    description: 'Spin a lively wheel and let chance make the call.',
    component: WheelModule
  },
  {
    id: 'circle',
    name: 'Circle',
    description: 'Place fingers on screen and let one position win.',
    component: CircleModule
  }
];
