export const PERSONNEL_ROLES =
["Εργοδηγοί",  "Επιστάτες", "Τεχνίτες", "Βοηθοί", "Εργάτες", "Χειριστές","Οδηγοί"];

export const LABELS = {   
    personnel   : "ΕΡΓΑΖΟΜΕΝΟ ΠΡΟΣΩΠΙΚΟ",
    count       : "ΑΡΙΘΜΟΣ",
    workDetails : "ΕΚΤΕΛΟΥΜΕΝΕΣ ΕΡΓΑΣΙΕΣ",
    role        : "ΡΟΛΟΣ",
    addPersonnel: "ΠΡΟΣΘΗΚΗ ΕΡΓΑΖΟΜΕΝΟΥ",
    equipment   : "ΑΠΑΣΧΟΛΟΥΜΕΝΑ ΜΗΧΑΝΗΜΑΤΑ",
    type        : "ΕΙΔΟΣ",
    material    : "ΠΡΟΣΚΟΜΙΣΘΕΝΤΑ ΥΛΙΚΑ",
    notes       : "ΠΑΡΑΤΗΡΗΣΕΙΣ",
    details     : "Λεπτομέρειες",
    status      : "Κατάσταση",
    total       : "Σύνολο"
}

export const FORM_STATUS = {
    PENDING: "pending",
    SIGNED: "signed"
  }

// Rendered inside `.status-badge` (text-transform: uppercase); Greek all-caps take no accents.
export const FORM_STATUS_LABELS = {
  pending: "ΣΕ ΕΞΕΛΙΞΗ",
  signed: "ΥΠΟΓΕΓΡΑΜΜΕΝΗ"
};

export const FORM_STATUS_CLASSES = {
    pending: "status-pending",
    signed: "status-signed",
    unknown: "status-unknown",
  } 