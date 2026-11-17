/* Tray contents and missions. */
export const ITEMS = [
  {g:"Signals", c:"sig", list:[
    {key:"epi", label:"Epinephrine", sub:"hormone", dot:"Epi"},
    {key:"insulin", label:"Insulin", sub:"peptide hormone", dot:"Ins"},
    {key:"ach", label:"Acetylcholine", sub:"neurotransmitter", dot:"ACh"},
    {key:"cortisol", label:"Cortisol", sub:"steroid hormone", dot:"Cor"},
    {key:"adenosine", label:"Adenosine", sub:"agonist", dot:"Ado"},
    {key:"caffeine", label:"Caffeine", sub:"antagonist", dot:"Caf"},
    {key:"angio", label:"Angiotensin II", sub:"hormone", dot:"AngII"},
    {key:"egf", label:"EGF", sub:"growth factor", dot:"EGF"},
    {key:"norad", label:"Noradrenaline", sub:"cold signal", dot:"NA"}]},
  {g:"Transport", c:"endo", list:[
    {key:"adh", label:"ADH", sub:"water hormone", dot:"ADH"},
    {key:"ldl", label:"LDL", sub:"cholesterol carrier", dot:"LDL"}]},
  {g:"Energy", c:"nrg", list:[
    {key:"glucose", label:"Glucose", sub:"fuel", dot:"Glc"},
    {key:"ucp1item", label:"UCP1", sub:"uncoupling protein", dot:"UCP"}]},
  {g:"Enzymes & drugs", c:"bio", list:[
    {key:"xatp", label:"Excess ATP", sub:"allosteric inhibitor", dot:"ATP"},
    {key:"tetra", label:"Tetracycline", sub:"antibiotic", dot:"Tet"},
    {key:"highnrg", label:"High NADH + ATP", sub:"feedback inhibitors", dot:"NADH"}]},
  {g:"Protein tags", c:"endo", list:[
    {key:"sigpep", label:"Signal peptide", sub:"→ rough ER", dot:"SP"},
    {key:"kdel", label:"KDEL", sub:"→ stay in ER", dot:"KDEL"},
    {key:"nls", label:"NLS", sub:"→ nucleus", dot:"NLS"},
    {key:"mtag", label:"Mito signal", sub:"→ matrix", dot:"MTS"},
    {key:"skl", label:"-SKL", sub:"→ peroxisome", dot:"SKL"},
    {key:"ubiq", label:"Ubiquitin", sub:"→ proteasome", dot:"Ub"}]},
  {g:"Genetics", c:"gen", list:[
    {key:"silent", label:"Silent mutation", sub:"GGA → GGG", dot:"sil"},
    {key:"missense", label:"Missense mutation", sub:"GAC → GUC", dot:"mis"},
    {key:"mutation", label:"Nonsense mutation", sub:"UGG → UGA", dot:"non"},
    {key:"frameshift", label:"Frameshift", sub:"+1 base", dot:"fs"},
    {key:"rasmut", label:"Ras mutation", sub:"oncogene", dot:"Ras"}]},
  {g:"Endomembrane", c:"endo", list:[
    {key:"junk", label:"Worn-out protein", sub:"debris", dot:"Old"}]}
];

export const MISSIONS = [
  ["epi","Release glucose from glycogen (fight or flight)"],
  ["block","Block a receptor with an antagonist"],
  ["insulin","Move GLUT4 to the cell surface"],
  ["ach","Open a ligand-gated ion channel"],
  ["gene","Express a gene and secrete its protein"],
  ["atp32","Harvest ~32 ATP from one glucose"],
  ["ferment","Make ATP with no oxygen"],
  ["pfk","Stall glycolysis with feedback inhibition"],
  ["nonsense","See a nonsense mutation's effect"],
  ["lyso","Recycle debris in a lysosome"],
  ["sglt","Pull glucose in with the Na⁺ gradient"],
  ["osmosis","Make water move by osmosis"],
  ["ldl","Bring in LDL by receptor-mediated endocytosis"],
  ["ip3","Release Ca²⁺ from the smooth ER with IP₃"],
  ["ras","Switch on the Ras → MAPK cascade"],
  ["cancer","See why a Ras mutation causes uncontrolled division"],
  ["heat","Make a brown fat cell produce heat"],
  ["target","Send proteins to 3 different destinations"],
  ["ethanol","Make ethanol by alcoholic fermentation"],
  ["pdh","Slow the citric acid cycle with feedback inhibition"],
  ["mutants","Express silent, missense and frameshift mutations"],
  ["denature","Denature an enzyme in the Enzyme lab"],
  ["dihybrid","Get a 9 : 3 : 3 : 1 ratio on the Genetics bench"]
];
