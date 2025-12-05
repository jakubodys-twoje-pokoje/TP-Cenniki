interface HotresDay {
  date: string;
  available: string; // "1" = free, "0" = booked
  reception: any;
}

interface HotresResponseItem {
  type_id: number;
  dates: HotresDay[];
}

export const fetchHotresOccupancy = async (
  oid: string,
  tid: string,
  startDate: string,
  endDate: string
): Promise<number> => {
  if (!oid || !tid) {
    throw new Error("Brak konfiguracji OID lub TID");
  }

  // Construct URL
  const baseUrl = "https://panel.hotres.pl/api_availability";
  const user = "admin@twojepokoje.com.pl";
  const pass = "Admin123@@";
  
  const url = `${baseUrl}?user=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&oid=${oid}&type_id=${tid}&from=${startDate}&till=${endDate}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      // Note: If CORS is an issue in browser, this might fail without a proxy or browser extension.
    });

    if (!response.ok) {
      throw new Error(`Błąd API: ${response.status}`);
    }

    const data: HotresResponseItem[] = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Pusta odpowiedź z API");
    }

    // Since we request for a specific type_id, we look for it
    const roomData = data.find(item => item.type_id === Number(tid));
    
    if (!roomData || !roomData.dates || roomData.dates.length === 0) {
      throw new Error("Brak danych dla tego pokoju");
    }

    const totalDays = roomData.dates.length;
    // Count days where available is "0" (Booked)
    const bookedDays = roomData.dates.filter(day => day.available === "0").length;

    // Calculate percentage
    const occupancyPercentage = (bookedDays / totalDays) * 100;

    return Math.round(occupancyPercentage);

  } catch (error) {
    console.error("Hotres Fetch Error:", error);
    throw error;
  }
};
