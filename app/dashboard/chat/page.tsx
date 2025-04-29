"use client";

import { useState, useEffect, useRef } from "react"; // Import useRef
import { io, Socket } from "socket.io-client";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"; // Import Supabase client helper
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@supabase/supabase-js"; // Import User type
import { Badge } from "@/components/ui/badge"; // Import Badge component

// Define message structure
interface ChatMessage {
  id: string; // Keep client-side ID for keys, or use DB id
  text: string;
  sender: "me" | "other";
  roomId: string; // Identify which chat the message belongs to
  timestamp: number; // Keep for sorting/display, or use created_at from DB
  senderId: string; // Add senderId to map DB data
  created_at?: string; // Add created_at from DB
}

// Define match structure
interface Match {
  id: string;
  name: string;
  avatar_url?: string | null; // Add avatar_url field
}

let socket: Socket | null = null; // Initialize socket as null

// Helper to create a consistent room ID between two users
const createRoomId = (userId1: string, userId2: string): string => {
  // Ensure IDs are strings before sorting
  return [String(userId1), String(userId2)].sort().join("--");
};

export default function ChatPage() {
  const supabase = createClientComponentClient(); // Create Supabase client for component
  const [currentUser, setCurrentUser] = useState<User | null>(null); // Store user object
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    avatar_url?: string | null;
  } | null>(null); // Store current user's profile details
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true); // Loading state
  const [errorMatches, setErrorMatches] = useState<string | null>(null); // Error state
  const [isSocketConnected, setIsSocketConnected] = useState(false); // Track socket connection status
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for the bottom element
  const [lastViewedTimestamps, setLastViewedTimestamps] = useState<
    Record<string, number>
  >({}); // Track last viewed time per room

  // Ref to hold the current user for use in callbacks without adding to dependencies
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Ref to hold the current room ID for use in callbacks
  const currentRoomIdRef = useRef(currentRoomId);
  useEffect(() => {
    currentRoomIdRef.current = currentRoomId;
  }, [currentRoomId]);

  // Get current user session & profile, handle auth changes
  useEffect(() => {
    const getUserAndProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      setCurrentUser(user);

      if (user) {
        // Fetch current user's profile including avatar_url
        const { data: profile, error: profileError } = await supabase
          .from("students")
          .select("avatar_url")
          .eq("user_id", user.id)
          .single();

        if (profileError) {
          console.error("Error fetching current user profile:", profileError);
          setCurrentUserProfile(null);
        } else {
          setCurrentUserProfile(profile);
        }
      } else {
        setCurrentUserProfile(null); // Clear profile if no user
        setIsLoadingMatches(false); // Stop loading if no user initially
      }
    };
    getUserAndProfile();

    // Listen for auth changes (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Make async to fetch profile on change
        const previousUserId = currentUserRef.current?.id;
        const user = session?.user ?? null;
        setCurrentUser(user);

        // Reset chat state if user logs out or changes
        if (previousUserId !== user?.id) {
          console.log("Auth state changed, user is now:", user?.id);
          setMatches([]);
          setChatHistory([]);
          setSelectedChatId(null);
          setCurrentRoomId(null);
          setCurrentUserProfile(null); // Reset profile

          if (user) {
            // Fetch profile for the new user
            const { data: profile, error: profileError } = await supabase
              .from("students")
              .select("avatar_url")
              .eq("user_id", user.id)
              .single();

            if (profileError) {
              console.error("Error fetching new user profile:", profileError);
            } else {
              setCurrentUserProfile(profile);
            }
          } else {
            setIsLoadingMatches(false); // Ensure loading stops on logout
          }
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
    // Dependency array includes supabase
  }, [supabase]);

  const currentUserId = currentUser?.id; // Get ID from user object

  // Fetch matches effect (depends on currentUserId)
  useEffect(() => {
    if (!currentUserId) {
      setIsLoadingMatches(false); // Stop loading if no user
      setMatches([]); // Clear matches if logged out
      return;
    }

    const fetchMatches = async () => {
      setIsLoadingMatches(true);
      setErrorMatches(null);
      try {
        // Fetch should now work as the API route uses Supabase auth
        const response = await fetch("/api/matches");
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `HTTP error! status: ${response.status}`
          );
        }
        const data: Match[] = await response.json(); // Expect Match[] with avatar_url
        setMatches(data);
      } catch (error: any) {
        console.error("Error fetching matches:", error);
        setErrorMatches(error.message || "Failed to load matches.");
      } finally {
        setIsLoadingMatches(false);
      }
    };
    fetchMatches();
  }, [currentUserId]); // Re-run when currentUserId changes

  // ... (rest of the useEffect hooks for socket and room handling remain largely the same) ...
  // Initialize Socket.IO effect
  useEffect(() => {
    if (!currentUserId) {
      if (socket) {
        console.log("No user ID, disconnecting socket.");
        // Ensure listeners are removed before disconnecting
        socket.off("connect");
        socket.off("disconnect");
        socket.off("connect_error");
        socket.off("receiveMessage");
        socket.disconnect();
        socket = null;
        setIsSocketConnected(false);
      }
      return;
    }

    // Only attempt connection if socket doesn't exist
    if (!socket) {
      console.log("Attempting socket connection for user:", currentUserId);

      // Double-check: User might have logged out *before* connection attempt
      // Also check if another effect instance already created the socket
      if (!currentUserRef.current || socket) {
        // Check socket again here
        console.log(
          "User logged out before connection or socket already exists. Aborting connection."
        );
        return;
      }

      console.log("Initializing IO client...");
      const newSocket = io({
        autoConnect: true,
        transports: ["websocket"], // Force WebSocket transport
      });
      socket = newSocket; // Assign to module-level variable

      newSocket.on("connect", () => {
        const userId = currentUserRef.current?.id;
        if (userId) {
          console.log("Socket connected:", newSocket.id, "for user:", userId);
          setIsSocketConnected(true);
          newSocket.emit("registerUser", userId);
        } else {
          console.warn(
            "Socket connected but user ID is missing in ref. Disconnecting."
          );
          newSocket.disconnect(); // Disconnect if user vanished
          socket = null; // Nullify the socket ref
          setIsSocketConnected(false);
        }
      });

      newSocket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        setIsSocketConnected(false);
        // Nullify the socket variable ONLY if it's the one we are handling
        if (socket === newSocket) {
          socket = null;
        }
      });

      newSocket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        setIsSocketConnected(false);
        if (socket === newSocket) {
          socket = null; // Clean up on error too
        }
      });

      // Define the listener function separately
      const receiveMessageHandler = (msg: {
        text: string;
        roomId: string;
        senderId: string;
      }) => {
        const userId = currentUserRef.current?.id;
        const activeRoomId = currentRoomIdRef.current; // Use the ref

        // Ignore messages if sender is the current user
        if (msg.senderId === userId) {
          return;
        }

        // Message is from someone else
        if (msg.roomId === activeRoomId) {
          // Message for the currently active room
          const newMessageId = `${msg.senderId}-${Date.now()}`;
          // No longer need to set firstUnreadMessageId here

          setChatHistory((prev) => [
            ...prev,
            {
              id: newMessageId, // Use generated ID for optimistic update
              text: msg.text,
              sender: "other",
              roomId: msg.roomId,
              timestamp: Date.now(), // Add timestamp on receive
              senderId: msg.senderId, // Add senderId to map DB data
            },
          ]);
        } else {
          // Optional TODO: Handle message for inactive room (e.g., show badge)
          console.log(`Received message for inactive room: ${msg.roomId}`);
        }
      };

      // Attach the listener
      newSocket.on("receiveMessage", receiveMessageHandler);

      // Return cleanup function for this specific socket instance
      return () => {
        console.log("Cleaning up socket instance:", newSocket.id);
        newSocket.off("connect");
        newSocket.off("disconnect");
        newSocket.off("connect_error");
        newSocket.off("receiveMessage", receiveMessageHandler); // Remove specific listener
        if (newSocket.connected) {
          newSocket.disconnect();
        }
        // Only nullify the global socket if it's the one we are cleaning up
        if (socket === newSocket) {
          socket = null;
          setIsSocketConnected(false);
        }
      };
    }

    // Separate cleanup for the effect itself when currentUserId changes
    return () => {
      console.log("Socket effect cleanup due to user change:", currentUserId);
      if (socket) {
        console.log("Disconnecting existing socket due to user change.");
        // Remove all listeners and disconnect
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
        setIsSocketConnected(false);
      }
    };
    // Dependencies: Only re-run if the user ID changes.
    // The connection logic itself handles the !socket condition internally.
  }, [currentUserId]);

  // Effect for joining/leaving rooms and fetching history
  useEffect(() => {
    // Function to fetch history for a room
    const fetchHistory = async (roomId: string) => {
      // Ensure supabase client and user ID are available
      if (!supabase || !currentUserId) {
        console.warn(
          "Supabase client or user ID not available for fetching history."
        );
        setChatHistory([]); // Clear history if prerequisites missing
        return;
      }

      console.log(`Fetching history for room: ${roomId}`);
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("id, room_id, sender_id, message_text, created_at")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true }); // Fetch in chronological order

        if (error) {
          console.error("Error fetching chat history:", error);
          setChatHistory([]); // Clear history on error
          return;
        }

        if (data) {
          const formattedHistory: ChatMessage[] = data.map((msg) => ({
            id: msg.id, // Use DB ID
            text: msg.message_text,
            sender: msg.sender_id === currentUserId ? "me" : "other", // Determine sender based on currentUserId
            roomId: msg.room_id,
            timestamp: new Date(msg.created_at).getTime(), // Convert DB timestamp
            senderId: msg.sender_id,
            created_at: msg.created_at,
          }));
          console.log(`Fetched ${formattedHistory.length} messages.`);
          setChatHistory(formattedHistory); // Replace local state with fetched history
        } else {
          console.log("No history found for this room.");
          setChatHistory([]); // No history found for this room
        }
      } catch (fetchError) {
        console.error("Failed to execute fetch history query:", fetchError);
        setChatHistory([]); // Clear history on unexpected error
      }
    };

    // Determine the target room ID based on current state
    const targetRoomId =
      currentUserId && selectedChatId
        ? createRoomId(currentUserId, selectedChatId)
        : null;

    // Only proceed if we have a target room and a connected socket
    if (targetRoomId && socket && isSocketConnected) {
      // Check if the room needs to change
      if (targetRoomId !== currentRoomIdRef.current) {
        console.log(`Joining room: ${targetRoomId}`);
        socket.emit("joinRoom", targetRoomId);
        setCurrentRoomId(targetRoomId); // Update state
        fetchHistory(targetRoomId); // Fetch history for the new room
      } else {
        // Already in the correct room, maybe fetch history if it's empty?
        // This depends on desired behavior - e.g., re-fetch on reconnect?
        // For now, we assume history is fetched only on room join.
        console.log(`Already in room: ${targetRoomId}`);
      }
    } else {
      // Conditions not met (no user, no selection, no socket, or not connected)
      // Ensure we are not in any room if state is invalid
      if (currentRoomIdRef.current && socket && socket.connected) {
        console.log(`State invalid, leaving room: ${currentRoomIdRef.current}`);
        socket.emit("leaveRoom", currentRoomIdRef.current);
        setCurrentRoomId(null); // Clear room state
        setChatHistory([]); // Clear history
      }
    }

    // Cleanup function: This runs when dependencies change OR component unmounts
    return () => {
      const roomToLeave = currentRoomIdRef.current; // Get the room ID *before* state updates
      // Leave the *previous* room if the socket is still valid and connected
      if (roomToLeave && socket && socket.connected) {
        console.log(`Effect cleanup: Leaving room ${roomToLeave}`);
        socket.emit("leaveRoom", roomToLeave);
        // Don't clear state here, the next effect run will handle it
      }
    };
  }, [
    selectedChatId, // Re-run if selected chat changes
    currentUserId, // Re-run if user changes
    isSocketConnected, // Re-run if socket connection status changes
    supabase, // Keep supabase as dependency for fetchHistory
    // currentRoomId is NOT needed here, managed via ref and state update
  ]);

  // Filter chat history for the selected room
  const filteredChatHistory = chatHistory.filter(
    (msg) => msg.roomId === currentRoomId
  );

  // Determine the last viewed time for the current room (MOVED HERE)
  const lastViewedTime = currentRoomId
    ? lastViewedTimestamps[currentRoomId] || 0
    : 0;

  // Effect to scroll to bottom when chat history changes
  useEffect(() => {
    // Scroll the messagesEndRef into view
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredChatHistory]); // Dependency: run when filtered history changes

  // Find the index of the first unread message from the other user
  // Only search if the user has actually viewed the chat before (lastViewedTime > 0)
  const firstUnreadIndex =
    lastViewedTime > 0
      ? filteredChatHistory.findIndex((msg) => {
          const isMe = msg.sender === "me";
          // Prefer DB timestamp if available, otherwise use client timestamp
          const messageTime = msg.created_at
            ? new Date(msg.created_at).getTime()
            : msg.timestamp;
          const isValidTime =
            typeof messageTime === "number" && !isNaN(messageTime);
          // Condition: Valid time, after last view, and not sent by the current user
          return isValidTime && messageTime > lastViewedTime && !isMe;
        })
      : -1; // If lastViewedTime is 0, set index to -1 (no separator)

  // handleSend function: Save message to DB then emit
  const handleSend = async (e: React.FormEvent) => {
    // Make async
    e.preventDefault();
    // Add explicit check for socket existence and connection
    if (
      supabase && // Check supabase client
      socket &&
      isSocketConnected &&
      message.trim() &&
      currentRoomId &&
      selectedChatId &&
      currentUserId
    ) {
      const tempId = `${currentUserId}-${Date.now()}`; // Temporary ID for UI update
      const messageText = message; // Store message before clearing
      setMessage(""); // Clear input immediately for better UX

      // 1. Optimistically update UI
      const newMessage: ChatMessage = {
        id: tempId, // Use temporary ID
        text: messageText,
        sender: "me",
        roomId: currentRoomId,
        timestamp: Date.now(),
        senderId: currentUserId,
      };
      setChatHistory((prev) => [...prev, newMessage]);

      try {
        // 2. Save message to Supabase
        const { data: insertedMessage, error } = await supabase
          .from("chat_messages")
          .insert({
            room_id: currentRoomId,
            sender_id: currentUserId,
            message_text: messageText,
          })
          .select("id, created_at") // Select the generated ID and timestamp
          .single(); // Expect a single row back

        if (error) {
          console.error("Error saving message:", error);
          // Revert optimistic update or show error
          setChatHistory((prev) => prev.filter((msg) => msg.id !== tempId));
          setMessage(messageText); // Restore input field
          // Optionally show a toast notification for the error
          return; // Stop if DB insert failed
        }

        // Optional: Update the message in state with the real ID and timestamp from DB
        if (insertedMessage) {
          setChatHistory((prev) =>
            prev.map((msg) =>
              msg.id === tempId
                ? {
                    ...msg,
                    id: insertedMessage.id, // Update with real DB ID
                    timestamp: new Date(insertedMessage.created_at).getTime(), // Update with real DB timestamp
                    created_at: insertedMessage.created_at,
                  }
                : msg
            )
          );
        }

        // 3. Emit message via Socket.IO
        socket.emit("sendMessage", {
          text: messageText,
          roomId: currentRoomId,
          senderId: currentUserId,
          // You could include the DB id/timestamp here if needed by receiver
          // dbId: insertedMessage?.id,
          // dbTimestamp: insertedMessage?.created_at
        });
      } catch (dbError) {
        console.error("Database operation failed:", dbError);
        // Handle potential errors during the async operation
        setChatHistory((prev) => prev.filter((msg) => msg.id !== tempId));
        setMessage(messageText);
      }
    } else {
      console.warn("Cannot send message:", {
        hasMessage: !!message.trim(),
        isConnected: isSocketConnected,
        hasRoom: !!currentRoomId,
        hasSelectedChat: !!selectedChatId,
        hasUser: !!currentUserId,
        hasSocket: !!socket,
        isSocketReallyConnected: socket?.connected,
        hasSupabase: !!supabase, // Log if supabase client exists
      });
    }
  };

  // Function to handle selecting a chat
  const handleSelectChat = (matchId: string) => {
    setSelectedChatId(matchId);
  };

  const selectedChatName =
    matches.find((m) => m.id === selectedChatId)?.name || "Chat";

  // Render Loading/Error states for matches
  let matchesContent;
  if (!currentUser && !isLoadingMatches) {
    // Handle logged out state explicitly
    matchesContent = <p className="text-gray-400 p-4">Please log in.</p>;
  } else if (isLoadingMatches) {
    matchesContent = <p className="text-gray-400 p-4">Loading matches...</p>;
  } else if (errorMatches) {
    matchesContent = <p className="text-red-500 p-4">Error: {errorMatches}</p>;
  } else if (matches.length === 0) {
    matchesContent = <p className="text-gray-400 p-4">No matches found.</p>;
  } else {
    matchesContent = matches.map((match) => {
      return (
        <Button
          key={match.id}
          variant="ghost"
          className={`w-full justify-start p-3 mb-1 flex items-center ${
            selectedChatId === match.id
              ? "bg-blue-500/20 hover:bg-blue-500/30"
              : "hover:bg-gray-700/50"
          }`}
          onClick={() => handleSelectChat(match.id)} // Use handler function
        >
          <Avatar className="h-8 w-8 mr-3 flex-shrink-0">
            {/* Use fetched avatar_url for sidebar */}
            <AvatarImage
              src={
                match.avatar_url ||
                `https://api.dicebear.com/8.x/initials/svg?seed=${match.name}`
              } // Fallback to DiceBear
              alt={match.name}
            />
            <AvatarFallback>
              {match.name?.substring(0, 2) || "??"}
            </AvatarFallback>
          </Avatar>
          <span className="flex-grow truncate mr-2">
            {match.name || "Unknown User"}
          </span>
        </Button>
      );
    });
  }

  // Initial loading state for user - MOVED TO TOP OF RETURN LOGIC
  if (currentUser === undefined) {
    // Check for undefined during initial load
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        Loading user...
      </div>
    );
  }

  // Main component return - NOW CORRECTLY PLACED
  return (
    <div className="h-screen flex bg-gray-900 text-white bg-transparent">
      {/* Sidebar for Matches */}
      <div className="w-1/4 border-r border-blue-500/20 flex flex-col min-w-[10rem]">
        <div className="p-4 border-b border-blue-500/20">
          <h2 className="text-xl font-semibold">Matches</h2>
        </div>
        {/* Use matchesContent defined earlier */}
        <ScrollArea className="flex-1 p-2">{matchesContent}</ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {!currentUserId ? (
          // Wrap the content in a fragment or a div
          <>
            <div className="flex-1 flex items-center justify-center"></div>{" "}
            {/* This div seems empty, maybe intended to contain the paragraph? */}
            <p className="text-gray-400 text-lg">Please log in to chat.</p>
          </> // Closing fragment tag
        ) : selectedChatId ? (
          <>
            <div className="p-6 border-b border-blue-500/20">
              <h1 className="text-2xl font-bold">
                Chat with {selectedChatName}
              </h1>
            </div>

            <ScrollArea
              className="flex-1 p-6" /* Use ScrollArea for chat history */
              // ref is no longer needed here for auto-scroll
            >
              <div className="space-y-4">
                {filteredChatHistory.map((msg, index) => {
                  // Add index here
                  // Determine sender information
                  const isMe = msg.sender === "me";
                  const senderId = msg.senderId;

                  // Find the match details for the 'other' sender
                  const otherMatch = matches.find((m) => m.id === senderId);

                  // Determine name and avatar URL based on sender
                  const senderName = isMe
                    ? currentUser?.user_metadata?.name || "Me"
                    : otherMatch?.name || "Unknown User";

                  const avatarUrl = isMe
                    ? currentUserProfile?.avatar_url // Use current user's profile avatar
                    : otherMatch?.avatar_url; // Use matched user's avatar

                  // Fallback avatar using DiceBear if URL is missing
                  const fallbackAvatarUrl = `https://api.dicebear.com/8.x/initials/svg?seed=${senderName}`;

                  // Determine message time (prefer DB timestamp)
                  const messageTime = msg.created_at
                    ? new Date(msg.created_at).getTime()
                    : msg.timestamp;
                  const isValidTime =
                    typeof messageTime === "number" && !isNaN(messageTime);

                  // Determine if the separator should be shown *at this specific index*
                  const showSeparator = index === firstUnreadIndex; // Show only at the found index

                  return (
                    // Use a simple div wrapper for the key
                    <div key={msg.id}>
                      {/* Render separator if this is the first unread message */}
                      {showSeparator && (
                        <div className="relative my-4">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-red-500" />
                          </div>
                          <div className="relative flex justify-center">
                            <span className="bg-gray-900 px-2 text-xs text-red-500">
                              New Messages
                            </span>
                          </div>
                        </div>
                      )}
                      {/* Original Message Div */}
                      <div
                        className={`flex gap-x-3 ${
                          // Add gap for avatar
                          isMe ? "justify-end" : "justify-start"
                        }`}
                      >
                        {/* Avatar for 'other' sender (left side) */}
                        {!isMe && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={avatarUrl || fallbackAvatarUrl}
                              alt={senderName}
                            />
                            <AvatarFallback>
                              {senderName?.substring(0, 2) || "???"}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        {/* Message Bubble and Timestamp */}
                        <div
                          className={`flex flex-col ${
                            // Group bubble and time
                            isMe ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`${
                              isMe ? "bg-blue-600" : "bg-gray-700"
                            } text-white rounded-lg p-3 max-w-md break-words`}
                          >
                            <p>{msg.text}</p>
                          </div>
                          <span className="text-xs text-gray-400 mt-1 px-1">
                            {new Date(msg.timestamp).toLocaleString([], {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Avatar for 'me' sender (right side) */}
                        {isMe && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={avatarUrl || fallbackAvatarUrl}
                              alt={senderName}
                            />
                            <AvatarFallback>
                              {senderName?.substring(0, 2) || "Me"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Empty div at the end to scroll to */}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-6 border-t border-blue-500/20">
              <form onSubmit={handleSend} className="flex gap-x-4">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  // Update last viewed time on focus
                  onFocus={() => {
                    if (currentRoomId) {
                      setLastViewedTimestamps((prev) => ({
                        ...prev,
                        [currentRoomId]: Date.now(),
                      }));
                    }
                  }}
                  placeholder={
                    isSocketConnected ? "Type your message..." : "Connecting..."
                  }
                  className="flex-1 bg-gray-800 border-blue-500/40 text-white placeholder-gray-400 disabled:opacity-50" // Added disabled style
                  disabled={!isSocketConnected} // Disable input if not connected
                />
                <Button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50" // Added disabled style
                  disabled={!isSocketConnected || !message.trim()} // Also disable if message is empty
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400 text-lg">
              Select a match to start chatting
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
