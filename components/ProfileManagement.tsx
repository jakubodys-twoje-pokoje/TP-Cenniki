import React, { useState } from "react";
import { Profile } from "../types";
import { Plus, Edit2, Trash2, Copy, Check, X, GripVertical } from "lucide-react";

interface ProfileManagementProps {
  profiles: Profile[];
  activeProfileId: string;
  onProfileChange: (profileId: string) => void;
  onAddProfile: (name: string, duplicateFromProfileId?: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onDuplicateProfile: (profileId: string) => void;
  onProfileUpdate: (profileId: string, updates: Partial<Profile>) => void;
  isReadOnly?: boolean;
}

const ProfileManagement: React.FC<ProfileManagementProps> = ({
  profiles,
  activeProfileId,
  onProfileChange,
  onAddProfile,
  onDeleteProfile,
  onDuplicateProfile,
  onProfileUpdate,
  isReadOnly = false,
}) => {
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDescription, setNewProfileDescription] = useState("");
  const [duplicateFrom, setDuplicateFrom] = useState<string>("");

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const handleAddProfile = () => {
    if (!newProfileName.trim()) {
      alert("Podaj nazwę profilu");
      return;
    }

    onAddProfile(newProfileName.trim(), duplicateFrom || undefined);
    setIsAddingProfile(false);
    setNewProfileName("");
    setNewProfileDescription("");
    setDuplicateFrom("");
  };

  const handleStartEdit = (profile: Profile) => {
    setEditingProfileId(profile.id);
    setEditName(profile.name);
    setEditDescription(profile.description || "");
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      alert("Podaj nazwę profilu");
      return;
    }

    if (editingProfileId) {
      onProfileUpdate(editingProfileId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setEditingProfileId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingProfileId(null);
    setEditName("");
    setEditDescription("");
  };

  if (isReadOnly) {
    return (
      <div className="bg-slate-50 p-4 rounded-lg">
        <p className="text-sm text-slate-600">
          Zarządzanie profilami jest niedostępne w trybie tylko do odczytu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Zarządzanie Profilami</h3>
          <p className="text-sm text-slate-600 mt-1">
            Twórz różne scenariusze cenowe dla tej nieruchomości
          </p>
        </div>
        <button
          onClick={() => setIsAddingProfile(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Dodaj Profil
        </button>
      </div>

      {/* Add Profile Form */}
      {isAddingProfile && (
        <div className="bg-white p-4 rounded-lg border-2 border-blue-500 shadow-lg">
          <h4 className="font-semibold text-slate-800 mb-3">Nowy Profil</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nazwa profilu *
              </label>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="np. Święta, Poza sezonem, Premium"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Opis (opcjonalnie)
              </label>
              <input
                type="text"
                value={newProfileDescription}
                onChange={(e) => setNewProfileDescription(e.target.value)}
                placeholder="np. Ceny w okresie świątecznym"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Skopiuj ustawienia z profilu (opcjonalnie)
              </label>
              <select
                value={duplicateFrom}
                onChange={(e) => setDuplicateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Nowy pusty profil --</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Możesz skopiować pokoje, kanały, sezony i ustawienia z istniejącego profilu
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setIsAddingProfile(false);
                  setNewProfileName("");
                  setNewProfileDescription("");
                  setDuplicateFrom("");
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleAddProfile}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Check size={16} />
                Utwórz Profil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profiles List */}
      <div className="space-y-2">
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfileId;
          const isEditing = editingProfileId === profile.id;

          return (
            <div
              key={profile.id}
              className={`bg-white p-4 rounded-lg border-2 transition-all ${
                isActive
                  ? "border-blue-500 shadow-md"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {isEditing ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nazwa
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Opis
                    </label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    >
                      Anuluj
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <Check size={14} />
                      Zapisz
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="flex items-center justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => onProfileChange(profile.id)}>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-800">{profile.name}</h4>
                          {isActive && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                              Aktywny
                            </span>
                          )}
                          {profile.isDefault && (
                            <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                              Domyślny
                            </span>
                          )}
                        </div>
                        {profile.description && (
                          <p className="text-sm text-slate-600 mt-0.5">{profile.description}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-slate-500">
                          <span>{profile.rooms?.length || 0} pokoi</span>
                          <span>{profile.seasons?.length || 0} sezonów</span>
                          <span>{profile.channels?.length || 0} kanałów</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={() => handleStartEdit(profile)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      title="Edytuj"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDuplicateProfile(profile.id)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      title="Duplikuj"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => onDeleteProfile(profile.id)}
                      disabled={profiles.length === 1}
                      className={`p-2 rounded transition-colors ${
                        profiles.length === 1
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-red-600 hover:bg-red-50"
                      }`}
                      title={profiles.length === 1 ? "Nie można usunąć jedynego profilu" : "Usuń"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>Wskazówka:</strong> Profile pozwalają tworzyć różne scenariusze cenowe dla tej
          samej nieruchomości. Każdy profil ma własne pokoje, sezony, kanały i ustawienia. Możesz
          łatwo przełączać się między profilami, aby porównać różne strategie cenowe.
        </p>
      </div>
    </div>
  );
};

export default ProfileManagement;
