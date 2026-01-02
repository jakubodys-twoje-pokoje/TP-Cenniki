import React from "react";
import { Profile } from "../types";
import { ChevronDown, CheckCircle2 } from "lucide-react";

interface ProfileSelectorProps {
  profiles: Profile[];
  activeProfileId: string;
  onProfileChange: (profileId: string) => void;
  isReadOnly?: boolean;
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  profiles,
  activeProfileId,
  onProfileChange,
  isReadOnly = false,
}) => {
  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const [isOpen, setIsOpen] = React.useState(false);

  if (!activeProfile) return null;

  // Predefined colors for profiles (cycles through them)
  const profileColors = [
    { bg: "bg-blue-500", text: "text-white", hover: "hover:bg-blue-600" },
    { bg: "bg-purple-500", text: "text-white", hover: "hover:bg-purple-600" },
    { bg: "bg-emerald-500", text: "text-white", hover: "hover:bg-emerald-600" },
    { bg: "bg-amber-500", text: "text-white", hover: "hover:bg-amber-600" },
    { bg: "bg-rose-500", text: "text-white", hover: "hover:bg-rose-600" },
  ];

  const activeColorIndex = profiles.findIndex((p) => p.id === activeProfileId) % profileColors.length;
  const activeColor = profileColors[activeColorIndex];

  return (
    <div className={`sticky top-0 z-10 ${activeColor.bg} ${activeColor.text} shadow-md mb-4 print:hidden`}>
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Profile Name Display */}
          <div className="flex items-center gap-2">
            <div className="text-[10px] uppercase font-semibold opacity-80 tracking-wide">
              Profil:
            </div>
            <div className="text-lg font-bold">
              {activeProfile.name}
            </div>
            {activeProfile.description && (
              <div className="text-xs opacity-75 italic">
                ({activeProfile.description})
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          {!isReadOnly && profiles.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 ${activeColor.hover} rounded-lg transition-colors font-semibold text-sm border-2 border-white border-opacity-30`}
              >
                <span>Zmień profil</span>
                <ChevronDown
                  size={16}
                  className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsOpen(false)}
                  />

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl z-20 overflow-hidden border border-slate-200">
                    <div className="py-1">
                      {profiles.map((profile, idx) => {
                        const isActive = profile.id === activeProfileId;
                        const color = profileColors[idx % profileColors.length];

                        return (
                          <button
                            key={profile.id}
                            onClick={() => {
                              onProfileChange(profile.id);
                              setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                              isActive
                                ? `${color.bg} ${color.text}`
                                : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <div className="flex-1">
                              <div className="font-semibold flex items-center gap-2">
                                {profile.name}
                                {isActive && <CheckCircle2 size={16} />}
                              </div>
                              {profile.description && (
                                <div
                                  className={`text-xs mt-0.5 ${
                                    isActive ? "opacity-90" : "text-slate-500"
                                  }`}
                                >
                                  {profile.description}
                                </div>
                              )}
                            </div>

                            {profile.isDefault && (
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${
                                  isActive
                                    ? "bg-white bg-opacity-20"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                Domyślny
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Read-only indicator */}
          {isReadOnly && (
            <div className="text-sm opacity-75 bg-white bg-opacity-20 px-3 py-1.5 rounded">
              Tylko do odczytu
            </div>
          )}

          {/* Single profile indicator */}
          {!isReadOnly && profiles.length === 1 && (
            <div className="text-sm opacity-75">
              1 profil dostępny
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSelector;
