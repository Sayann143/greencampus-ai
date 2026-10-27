/**
 * echoKnowledge.js — Comprehensive local campus intelligence responder for Echo AI.
 * 
 * Ensures Echo ALWAYS provides smart, helpful, empathetic answers to any query
 * (including non-issue questions like library hours, Wi-Fi, food, exams, clubs,
 * greetings, general conversation, and student advice) even if upstream external
 * API quotas are temporarily busy or the backend is cold-starting.
 */

export function getEchoLocalResponse(query) {
  const text = (query || '').toLowerCase().trim();
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Critical Emergency & Safety
  const criticalWords = ['fire', 'smoke', 'sparking', 'bare wire', 'explosion', 'collapse', 'gas leak', 'injury', 'blood', 'emergency', 'ambulance'];
  if (criticalWords.some(w => text.includes(w))) {
    return {
      reply:
        "🚨 **CRITICAL CAMPUS EMERGENCY ALERT** 🚨\n\n" +
        "1. **EVACUATE IMMEDIATELY:** Move to a safe, open outdoor area (Campus Main Lawn or designated Muster Station).\n" +
        "2. **STAY CLEAR:** Never touch pooling water near electrical panels, exposed wires, or debris.\n" +
        "3. **CALL CAMPUS SECURITY:** Dial the Campus Emergency Control Room right away!\n" +
        "4. **SUBMIT HIGH-PRIORITY REPORT:** Click **Report Issue** above, tag it **High Priority**, and provide the exact Block & Room so emergency teams respond immediately! 🚒⚡",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Report Emergency Issue 🚨', 'Campus Security ☎️', 'Dashboard Alerts 📊'],
    };
  }

  // 2. Greetings, Introductions & Identity
  const greetingRegex = /\b(hi|hello|hey|yo|sup|greetings|hola|good morning|good afternoon|good evening|who are you|who is echo|what can you do|what are you|help)\b/;
  if (greetingRegex.test(text)) {
    return {
      reply:
        "Hey there! 👋 I'm **Echo**, your 24/7 intelligent campus AI companion for **GreenCampus AI**! 🌿✨\n\n" +
        "### 🧠 What I'm Built Around\n" +
        "I'm designed to make university campus life safer, greener, and more connected! I connect students, faculty, and facilities staff across our university with real-time tools:\n\n" +
        "### 🚀 What I Can Help You With\n" +
        "• 💬 **Campus Q&A & Info:** Ask me about library hours, campus Wi-Fi, canteen spots, sports, clubs, or student tips!\n" +
        "• ⚡ **Facility Issue Triage:** Spot a broken AC in lab, water leak, flickering light, or overflowing bin? Tell me and I'll analyze urgency and help you file a report.\n" +
        "• 🤝 **Campus Connect:** Broadcast your availability for 15, 30, or 60 mins to find a study partner, grab coffee, or meet peers without awkward DMs!\n" +
        "• 📊 **Dashboard Telemetry:** Track live campus maintenance tickets and resolution statistics in real time.\n" +
        "• 🌱 **Eco & Green Living Hacks:** Learn university recycling bin locations, energy saving tips, and green habits.\n\n" +
        "What's on your mind today? Ask me anything or tap one of the quick cards below! ✨",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Library Hours 📚', 'Campus Wi-Fi 💻', 'Find Study Buddy ☕', 'Report Issue ✏️'],
    };
  }

  // 3. Library & Study Spaces
  if (['library', 'study space', 'study room', 'reading room', 'where to study', 'books', 'silent zone'].some(w => text.includes(w))) {
    return {
      reply:
        "📚 **Central Library & Study Spaces Guide:**\n\n" +
        "• **Timings:** Open Monday to Saturday from **8:00 AM to 10:00 PM** (open 24/7 during midterm and final exam weeks!).\n" +
        "• **Ground Floor:** Collaborative discussion pods and e-resource computer terminals.\n" +
        "• **2nd Floor:** Silent reading cubicles with personal charging ports and lamps.\n" +
        "• **Borrowing:** Up to 4 textbooks for 14 days using your Student ID card.\n\n" +
        "💡 *Pro-Tip:* Want a study partner right now? Hop over to **Campus Connect** and broadcast a study session at the Library! 🤝",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Open Campus Connect 🤝', 'Study Tips 📝', 'Dashboard Status 📊'],
    };
  }

  // 4. Wi-Fi, Internet & IT Support
  if (['wifi', 'wi-fi', 'internet', 'network', 'login', 'eduroam', 'portal', 'password', 'tech support'].some(w => text.includes(w))) {
    return {
      reply:
        "💻 **Campus Wi-Fi & IT Services:**\n\n" +
        "• **Network Name (SSID):** Connect to `'Campus-Student-5G'` or `'eduroam'`.\n" +
        "• **Credentials:** Use your university roll number / student email and portal password.\n" +
        "• **Coverage Hotspots:** Central Library, Student Activity Center (SAC), and Engineering Quads have the highest 5GHz bandwidth.\n" +
        "• **Troubleshooting:** If you are unable to authenticate or need a password reset, visit the **IT Helpdesk** (Tech Building, Room 104) or report a ticket under 'Other'. ⚡",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Report IT Issue ✏️', 'Campus Map 📍', 'Library Wi-Fi 📚'],
    };
  }

  // 5. Cafeteria, Canteen & Food
  if (['food', 'canteen', 'cafe', 'cafeteria', 'lunch', 'dinner', 'breakfast', 'coffee', 'snack', 'mess', 'hungry', 'eat'].some(w => text.includes(w))) {
    return {
      reply:
        "☕🍽️ **Campus Dining & Food Options:**\n\n" +
        "• **Main Cafeteria:** Serves full meals, thalis, and healthy salads (Breakfast: 7:30-10:00 AM, Lunch: 12:00-3:00 PM, Dinner: 7:00-9:30 PM).\n" +
        "• **SAC Cafe & Juice Bar:** Fresh coffee, tea, smoothies, and quick wraps (Open 8:00 AM - 10:00 PM).\n" +
        "• **Green Eco-Discount:** Bring your own reusable mug or tumbler to the cafe to get a **10% discount** and reduce single-use plastic waste! 🌱\n\n" +
        "Looking for someone to grab coffee or lunch with? Head to **Campus Connect** and broadcast a 15 or 30-min meetup!",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Meet for Coffee ☕', 'Eco Habits 🌱', 'Report Cleanliness 🧹'],
    };
  }

  // 6. Clubs, Sports, Gym & Student Life
  if (['club', 'sports', 'gym', 'badminton', 'cricket', 'football', 'fitness', 'workout', 'society', 'fest', 'hackathon', 'robotics'].some(w => text.includes(w))) {
    return {
      reply:
        "🎉🏆 **Sports, Clubs & Student Life:**\n\n" +
        "• **Campus Gym & Fitness Center:** Open daily **6:00 AM - 9:30 AM** and **4:30 PM - 9:00 PM** (Free entry for all enrolled students with gym attire).\n" +
        "• **Sports Complex:** Features 3 indoor wooden badminton courts, table tennis tables, and the outdoor football/cricket ground.\n" +
        "• **Student Clubs:** Over 20 active societies including Coding Club, Robotics Lab, GreenCampus Eco Alliance, Debating Society, and Photography Club.\n" +
        "• **Registrations:** Visit the Student Activity Center (SAC) desk or look out for Club Fair orientation week! ✨",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Find Study/Sport Buddy 🤝', 'Campus Map 📍', 'Eco Club 🌱'],
    };
  }

  // 7. Exams, Academics & Study Tips
  if (['exam', 'test', 'study tip', 'cgpa', 'grade', 'assignment', 'notes', 'syllabus', 'tips', 'prep'].some(w => text.includes(w))) {
    return {
      reply:
        "📝💡 **Exam Preparation & High-Efficiency Study Tips:**\n\n" +
        "1. **Active Recall & Feynman Technique:** Test yourself by explaining key formulas or concepts out loud without looking at textbook notes.\n" +
        "2. **Pomodoro Sprints:** 25 minutes of deep focus followed by a 5-minute break. After 4 cycles, take a longer 20-minute walk on the Campus Lawn.\n" +
        "3. **Peer Accountability:** Explaining problems to peers reinforces retention by up to 50%. Use **Campus Connect** to find classmates in your department for collaborative revision!\n" +
        "4. **Past Exam Papers:** Check the Central Library digital portal archives for previous semesters' test patterns. 🚀",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Find Study Partner 📚', 'Library Timings ⏰', 'Sustainability Hacks 🌿'],
    };
  }

  // 8. Hostels, Accommodation & Facilities
  if (['hostel', 'room', 'laundry', 'curfew', 'gate', 'dorm', 'shuttle', 'bus', 'transport', 'lost'].some(w => text.includes(w))) {
    return {
      reply:
        "🏠🚌 **Hostel & Campus Facilities Information:**\n\n" +
        "• **Hostel Hours & Curfew:** Normal entry cutoff is **10:00 PM** on weekdays (late-study library slips available from the Warden's office).\n" +
        "• **Laundry Facilities:** Automatic washing machines in hostel utility blocks open 8:00 AM - 9:00 PM.\n" +
        "• **Campus E-Shuttles:** Free electric shuttles run continuous loops between Hostels, Academic Quads, and the Main Gate every 15 minutes.\n" +
        "• **Lost & Found:** Located at the Security Desk on the ground floor of the Student Activity Center (SAC). 🛡️",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Report Facility Issue ✏️', 'Campus Connect 🤝', 'Dashboard 📊'],
    };
  }

  // 9. Water, Plumbing & Leaks
  if (['leak', 'water', 'pipe', 'tap', 'flood', 'drain', 'toilet', 'washroom', 'sink'].some(w => text.includes(w))) {
    return {
      reply:
        "💧 **Water & Plumbing Facility Support:**\n\n" +
        "Active water leaks are serious slip hazards and lead to massive water wastage! " +
        "Please avoid stepping in pooling water. Go to the **Report Issue** tab, select **Water & Plumbing**, and specify the exact Block and Washroom/Room number. " +
        "Our system prioritizes water emergencies for the facilities plumbing crew right away! 🛠️",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Report Water Leak 💧', 'Check Open Tickets 📊', 'Campus Map 📍'],
    };
  }

  // 10. Electrical & AC Issues
  if (['ac', 'air condition', 'cooler', 'light', 'power', 'spark', 'electric', 'switch', 'fan', 'projector'].some(w => text.includes(w))) {
    return {
      reply:
        "⚡ **Electrical & HVAC Support:**\n\n" +
        "Never touch sparking outlets or humming switches! " +
        "If a lab AC is malfunctioning or a lecture hall projector/light is out, submit a report under **Electrical** with the room number. " +
        "Electrical hazards are automatically escalated to **High Priority** for maintenance dispatch! 💡",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Report Electrical Issue ⚡', 'Check Dashboard 📊'],
    };
  }

  // 11. Cleanliness & Sanitation
  if (['trash', 'dustbin', 'clean', 'dirty', 'smell', 'garbage', 'waste', 'litter', 'spill'].some(w => text.includes(w))) {
    return {
      reply:
        "🧹 **Cleanliness & Sanitation Support:**\n\n" +
        "Maintaining a clean, hygienic university environment is essential for student well-being! " +
        "Submit a quick report specifying the cafeteria area, corridor, or washroom under **Cleanliness**. " +
        "Housekeeping will schedule waste clearance and sanitation services promptly. 🌿",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Report Cleanliness 🧹', 'View Open Tickets 📊'],
    };
  }

  // 12. Sustainability & Eco Campus Hacks
  if (['green', 'recycle', 'sustainable', 'waste', 'carbon', 'plant', 'solar', 'plastic'].some(w => text.includes(w))) {
    return {
      reply:
        "🌱 **GreenCampus Sustainability Guide:**\n\n" +
        "• **E-Waste Dropoff:** Drop expired batteries, old chargers, and broken cables in the blue recycling bin at the SAC foyer.\n" +
        "• **Paper & Plastics:** Colored segregated bins (Green = Organic, Blue = Dry Recyclables, Yellow = Plastic) are located across all academic floors.\n" +
        "• **Power Conservation:** Turn off monitors and projector units when leaving study pods and empty classrooms.\n" +
        "Every small green action keeps our university ranking high in sustainability! 💚",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Campus Green Map 🗺️', 'Report Energy Waste 💡', 'Find Study Buddy ☕'],
    };
  }

  // 13. Friendly Casual Banter ("how are you", "thank you", "thanks", "bye", "joke", "cool")
  if (['how are you', 'how r u', 'how are u', 'how do you do'].some(w => text.includes(w))) {
    return {
      reply:
        "I'm feeling energized and ready to help, thanks for asking! 🌿✨ How are your classes going today? Let me know if you need help navigating campus, finding a study buddy, or checking maintenance tickets! 🚀",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Find Study Buddy ☕', 'Library Timings 📚', 'Dashboard 📊'],
    };
  }

  if (['thank', 'thanks', 'thx', 'appreciate'].some(w => text.includes(w))) {
    return {
      reply:
        "You're very welcome! Always happy to assist fellow campus members. Feel free to ask anytime you need info, facility help, or eco tips! Have a productive day! 🌿✨",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Ask Another Question 💬', 'Campus Connect 🤝', 'Dashboard 📊'],
    };
  }

  if (['bye', 'goodbye', 'see you', 'cya', 'later'].some(w => text.includes(w))) {
    return {
      reply:
        "Take care and see you around campus! 👋 Don't hesitate to reach back out whenever you need anything. Stay safe and stay green! 🌿",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Campus Connect 🤝', 'Dashboard 📊'],
    };
  }

  if (['joke', 'funny', 'laugh'].some(w => text.includes(w))) {
    return {
      reply:
        "Here's one for you 😄:\n\n*Why did the solar panel go to university?*\n*Because it wanted to get a brighter education and absorb all the knowledge!* ☀️💡\n\nWhat can I help you with across campus today? ✨",
      provider: 'echo-engine',
      timestamp,
      suggested_actions: ['Library Hours 📚', 'Wi-Fi Guide 💻', 'Campus Connect 🤝'],
    };
  }

  // 14. Thoughtful Open-Ended Campus Assistant Response
  return {
    reply:
      `Got it! 🌿 Regarding "${query.length > 50 ? query.slice(0, 47) + '...' : query}":\n\n` +
      "As your university smart assistant, I can help you with:\n" +
      "• 📚 **Campus Information:** Library timings (8 AM - 10 PM), cafeteria options, Wi-Fi connectivity, and student clubs.\n" +
      "• 🤝 **Campus Connect:** Finding study buddies or coffee meetups across campus areas.\n" +
      "• 🛠️ **Facilities & Triage:** Checking ticket statuses or routing maintenance requests.\n" +
      "• 🌱 **Eco Advice:** Energy conservation tips and campus recycling programs.\n\n" +
      "Could you tell me a little more about what you'd like to know or accomplish? I'm happy to help! ✨",
    provider: 'echo-engine',
    timestamp,
    suggested_actions: ['Library Hours 📚', 'Campus Wi-Fi 💻', 'Campus Connect 🤝', 'Report Issue ✏️'],
  };
}
