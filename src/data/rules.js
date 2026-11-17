/* What happens when a molecule already in the cell is dragged onto a target.
   INCELL[entityKey][targetKey] = action id (an ACT handler in main.js) or a teaching message. */
export const INCELL = {
  atp: {
    nakpump: "pump",
    pfk: "xatp",
    ac: "Adenylyl cyclase only turns ATP into cAMP after an activated Gα subunit switches it on. Drop epinephrine on the β-adrenergic receptor first."
  },
  adp: { atpsyn: "synth" },
  na: {
    sglt: "sglt",
    nakpump: "The pump moves Na⁺ out against its gradient, but every cycle needs ATP. Drag an ATP here instead.",
    nachr: "This channel is closed. It only opens after acetylcholine binds."
  },
  k: { nakpump: "The pump brings K⁺ in against its gradient, but every cycle needs ATP. Drag an ATP here instead." },
  glucose: {
    glut1: "resp", glut4: "resp", sglt: "sglt",
    hk: "Glucose is polar. It has to enter through a GLUT transporter before hexokinase can phosphorylate it."
  },
  o2: { membrane: "o2", cyto: "o2", mito: "o2", c1: "o2", atpsyn: "o2" },
  nadh: { c1: "etc", mito: "NADH gives its electrons to complex I, on the inner membrane. Drop it right on complex I." },
  nad: { gapdh: "nad" },
  mrna: { rer: "translate", nucleus: "Mature mRNA is exported out of the nucleus through nuclear pores, not back in. It's read by ribosomes in the cytoplasm." },
  ribosome: {
    rer: "A free ribosome docks on the rough ER only once it starts translating a protein with an ER signal sequence: the signal recognition particle pauses translation and brings it to an SRP receptor."
  },
  junk: { lyso: "lyso" }
};
