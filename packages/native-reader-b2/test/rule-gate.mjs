import {loadB2Rules} from "../runtime.mjs";
const {approval} = await loadB2Rules(process.argv[2]);
console.log(JSON.stringify({check:"official-nonproduction-loadTurnPlugin", approval, database:false, sessions:0}));
