import type {Kind} from '@chm/rules';
// Every kind is named by its effect so filters and pickers stay distinguishable without colour alone.
export const kindInfo:Record<Kind,{effect:string;tone:string}>={
  '🅾':{effect:'Урон',tone:'orange'},
  '💢':{effect:'Урон и крит',tone:'red'},
  '💚':{effect:'Здоровье',tone:'pink'},
  '🧿':{effect:'Урон и крит',tone:'blue'},
  'raw-purple':{effect:'Сырьё · урон и крит',tone:'violet'},
  'raw-red':{effect:'Сырьё · урон и крит',tone:'crimson'},
  'raw-green':{effect:'Сырьё · урон',tone:'green'},
};
