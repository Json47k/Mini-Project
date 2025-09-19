const qrData = {
  red: {
    "R_ENTR": { 
      text: "Block N Entrance", 
      voice: "You are at the Block N Entrance. Walk straight ahead to the walkway.", 
      category: "entrance", 
      next: "R_WALKWAY" 
    },
    "R_WALKWAY": { 
      text: "Walkway", 
      voice: "You are on the walkway. Turn left to reach Room 101, or continue straight for Room 102.", 
      category: "hallway",
      next: "R_ROOM101"
    },
    "R_ROOM101": { 
      text: "Room 101", 
      voice: "You have arrived at Room 101. To reach Room 102, return to the walkway and go straight.", 
      category: "room",
      next: "R_ROOM102"
    },
    "R_ROOM102": { 
      text: "Room 102", 
      voice: "You have arrived at Room 102. This is the last stop on the ground floor.", 
      category: "room"
    }
  },
  green: {
    "G_EXIT1": { 
        text: "Emergency Exit A", 
        voice: "Follow the green signs to Emergency Exit A.", 
        category: "exit" 
    },
    "G_EXIT2": { 
        text: "Emergency Exit B", 
        voice: "Follow the green signs to Emergency Exit B.", 
        category: "exit" 
    },
    "G_HALLWAY1": { 
        text: "Hallway East Wing", 
        voice: "You are at the East Wing Hallway.", 
        category: "hallway" 
    },
    "G_HALLWAY2": { 
        text: "Hallway West Wing", 
        voice: "You are at the West Wing Hallway.", 
        category: "hallway" 
    }
  },
  blue: {
    "B_LAB1": { 
        text: "Silverlake Lab", 
        voice: "You are at Silverlake Lab. Proceed carefully inside.", 
        category: "lab" },
    "B_LAB2": { 
        text: "Huawei Lab", 
        voice: "You are at Huawei Lab. Follow lab safety rules.", 
        category: "lab" },
    "B_REST1": { 
        text: "Men's Restroom", 
        voice: "Men's Restroom is this way.", 
        category: "facility" },
    "B_REST2": { 
        text: "Women's Restroom", 
        voice: "Women's Restroom is this way.", 
        category: "facility" }
  }
};