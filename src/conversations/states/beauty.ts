// Beauty industry conversation flow
export interface QuickReply {
  title: string;
  next: string;
}

export interface ConversationState {
  message: string | ((businessData: any) => string);
  quickReplies?: QuickReply[];
}

export interface ConversationFlow {
  [key: string]: ConversationState;
}

export const beautyFlow: ConversationFlow = {
  START: {
    message: (businessData: any) => 
      `✨ Hi! Welcome to ${businessData.business_name || 'our beauty studio'}!\n\nHow can I help you today?`,
    quickReplies: [
      { title: "📅 Book Appointment", next: "BOOK" },
      { title: "💰 Pricing", next: "PRICES" },
      { title: "📍 Location & Hours", next: "LOCATION" },
      { title: "❓ Ask Question", next: "QUESTION" }
    ]
  },

  BOOK: {
    message: (businessData: any) => {
      if (businessData.booking_link) {
        return `Perfect! You can book your appointment here:\n\n${businessData.booking_link}\n\nIt only takes 2 minutes to secure your spot! 💫`;
      }
      return `I'd love to help you book! Please call us or send a DM with your preferred time. We'll get you scheduled right away! 📱`;
    },
    quickReplies: [
      { title: "💰 View Pricing", next: "PRICES" },
      { title: "📍 Location", next: "LOCATION" },
      { title: "🏠 Back to Menu", next: "START" }
    ]
  },

  PRICES: {
    message: () => 
      `Our services are competitively priced for premium quality! 💅\n\nEach treatment is customized to your needs. For exact pricing, I'd recommend booking a quick consultation - it's the best way to give you accurate costs.\n\nShall I help you book one?`,
    quickReplies: [
      { title: "📅 Book Consultation", next: "BOOK" },
      { title: "📍 Location & Hours", next: "LOCATION" },
      { title: "❓ Ask Question", next: "QUESTION" },
      { title: "🏠 Back to Menu", next: "START" }
    ]
  },

  LOCATION: {
    message: (businessData: any) => {
      let message = "📍 Here's where to find us:\n\n";
      
      if (businessData.location) {
        message += `${businessData.location}\n\n`;
      }
      
      if (businessData.hours) {
        message += `🕒 Hours: ${businessData.hours}\n\n`;
      }
      
      if (!businessData.location && !businessData.hours) {
        message += "Please DM us for our exact location and current hours!\n\n";
      }
      
      message += "Can't wait to see you! ✨";
      
      return message;
    },
    quickReplies: [
      { title: "📅 Book Now", next: "BOOK" },
      { title: "💰 Pricing", next: "PRICES" },
      { title: "❓ Ask Question", next: "QUESTION" },
      { title: "🏠 Back to Menu", next: "START" }
    ]
  },

  QUESTION: {
    message: () => 
      `I'm here to help! 💬\n\nWhat would you like to know? Feel free to ask about:\n• Specific treatments\n• Preparation tips\n• Aftercare\n• Anything else!\n\nJust type your question below 👇`,
    quickReplies: [
      { title: "📅 Book Appointment", next: "BOOK" },
      { title: "💰 Pricing Info", next: "PRICES" },
      { title: "📍 Location", next: "LOCATION" },
      { title: "🏠 Back to Menu", next: "START" }
    ]
  },

  END: {
    message: () => 
      `Thank you so much! 🙏\n\nWe can't wait to help you look and feel amazing. Have a beautiful day! ✨`,
    quickReplies: [
      { title: "🏠 Start Over", next: "START" }
    ]
  }
};