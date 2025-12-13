import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAstrology, fetchIkigai, calculateChart } from '../lib/api'
import { useState } from 'react'
import { Stars, Sun, Moon, Loader2, Save, MapPin, Search, Clock, AlertCircle, HelpCircle } from 'lucide-react'

export default function AstrologyProfile() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [birthData, setBirthData] = useState({
    year: '', month: '', day: '', hour: '', minute: '',
    latitude: '', longitude: '', timezone: 'America/New_York', location: '',
    birthTimeUnknown: false, selectedMoonSign: null
  })
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [moonSignOptions, setMoonSignOptions] = useState(null)

  const handleBirthTimeUnknownChange = (checked) => {
    if (checked) {
      setBirthData({
        ...birthData,
        birthTimeUnknown: true,
        hour: '12',
        minute: '0'
      })
    } else {
      setBirthData({
        ...birthData,
        birthTimeUnknown: false,
        hour: '',
        minute: ''
      })
    }
  }

  const lookupLocation = async () => {
    if (!birthData.location.trim()) {
      setLocationError('Please enter a location')
      return
    }
    setLocationLoading(true)
    setLocationError('')
    try {
      // Get coordinates from OpenStreetMap Nominatim
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(birthData.location)}&limit=1`,
        { headers: { 'User-Agent': 'CCBBB-Client-Portal' } }
      )
      const data = await response.json()
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat).toFixed(4)
        const lng = parseFloat(data[0].lon).toFixed(4)
        const locationName = data[0].display_name.split(',').slice(0, 3).join(',')

        // Get timezone from coordinates using TimeAPI
        let timezone = birthData.timezone
        try {
          const tzResponse = await fetch(
            `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lng}`
          )
          if (tzResponse.ok) {
            const tzData = await tzResponse.json()
            if (tzData.timeZone) {
              timezone = tzData.timeZone
            }
          }
        } catch (tzErr) {
          console.warn('Could not fetch timezone, using default:', tzErr)
        }

        setBirthData({
          ...birthData,
          latitude: lat,
          longitude: lng,
          timezone: timezone,
          location: locationName
        })
      } else {
        setLocationError('Location not found. Try a different search term.')
      }
    } catch (err) {
      setLocationError('Failed to lookup location. Please enter coordinates manually.')
    }
    setLocationLoading(false)
  }

  const { data: astrology, isLoading } = useQuery({
    queryKey: ['astrology'],
    queryFn: fetchAstrology
  })

  const { data: ikigai } = useQuery({
    queryKey: ['ikigai'],
    queryFn: fetchIkigai,
    enabled: astrology?.data?.data?.hasBirthData
  })

  const saveMutation = useMutation({
    mutationFn: (data) => calculateChart(data, true),
    onSuccess: () => {
      setSaveError('')
      queryClient.invalidateQueries({ queryKey: ['astrology'] })
      queryClient.invalidateQueries({ queryKey: ['ikigai'] })
      setEditing(false)
    },
    onError: (error) => {
      console.error('Save error:', error)
      setSaveError(error?.response?.data?.error || error?.message || 'Failed to save. Check console for details.')
    }
  })

  const astroData = astrology?.data?.data
  const ikigaiData = ikigai?.data?.data

  const handleSave = () => {
    saveMutation.mutate({
      ...birthData,
      year: parseInt(birthData.year),
      month: parseInt(birthData.month),
      day: parseInt(birthData.day),
      hour: parseInt(birthData.hour),
      minute: parseInt(birthData.minute),
      latitude: parseFloat(birthData.latitude),
      longitude: parseFloat(birthData.longitude),
      birthTimeUnknown: birthData.birthTimeUnknown,
      selectedMoonSign: birthData.selectedMoonSign
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Your Cosmic Blueprint</h1>
        <p className="text-gray-500 mt-1">
          Discover how the stars guide your business journey
        </p>
      </div>

      {(!astroData?.hasBirthData || editing) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Enter Your Birth Data</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input type="number" placeholder="1990" value={birthData.year}
                onChange={(e) => setBirthData({ ...birthData, year: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <input type="number" placeholder="1-12" min="1" max="12" value={birthData.month}
                onChange={(e) => setBirthData({ ...birthData, month: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
              <input type="number" placeholder="1-31" min="1" max="31" value={birthData.day}
                onChange={(e) => setBirthData({ ...birthData, day: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={birthData.birthTimeUnknown}
                  onChange={(e) => handleBirthTimeUnknownChange(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">I don't know my exact birth time</span>
              </label>
              {birthData.birthTimeUnknown && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">Using 12:00 PM as default birth time</p>
                      <p className="mt-1">Without an exact birth time:</p>
                      <ul className="list-disc ml-4 mt-1 space-y-1">
                        <li>House positions and Rising Sign cannot be calculated accurately</li>
                        <li>The Moon may have changed signs during your birth day</li>
                      </ul>
                      <p className="mt-2">You can enter an approximate time if you have a general idea (morning, afternoon, evening).</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="inline h-4 w-4 mr-1" />
                Hour (24h)
              </label>
              <input type="number" placeholder="0-23" min="0" max="23" value={birthData.hour}
                onChange={(e) => setBirthData({ ...birthData, hour: e.target.value })}
                disabled={birthData.birthTimeUnknown}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 ${birthData.birthTimeUnknown ? 'bg-gray-100 text-gray-500' : ''}`} />
              {birthData.birthTimeUnknown && (
                <p className="text-xs text-gray-500 mt-1">Default: 12 (noon)</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minute</label>
              <input type="number" placeholder="0-59" min="0" max="59" value={birthData.minute}
                onChange={(e) => setBirthData({ ...birthData, minute: e.target.value })}
                disabled={birthData.birthTimeUnknown}
                className={`w-full rounded-lg border border-gray-300 px-3 py-2 ${birthData.birthTimeUnknown ? 'bg-gray-100 text-gray-500' : ''}`} />
              {birthData.birthTimeUnknown && (
                <p className="text-xs text-gray-500 mt-1">Default: 0</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <input type="text" placeholder="America/New_York" value={birthData.timezone}
                onChange={(e) => setBirthData({ ...birthData, timezone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="inline h-4 w-4 mr-1" />
                Birth Location
              </label>
              <div className="flex gap-2">
                <input type="text" placeholder="City, State, Country (e.g., New York, NY, USA)"
                  value={birthData.location}
                  onChange={(e) => setBirthData({ ...birthData, location: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), lookupLocation())}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2" />
                <button type="button" onClick={lookupLocation} disabled={locationLoading}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50">
                  {locationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Lookup
                </button>
              </div>
              {locationError && <p className="text-red-500 text-sm mt-1">{locationError}</p>}
              <p className="text-gray-400 text-xs mt-1">Enter your birth city and click Lookup to auto-fill coordinates</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
              <input type="number" step="any" placeholder="40.7128" value={birthData.latitude}
                onChange={(e) => setBirthData({ ...birthData, latitude: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
              <input type="number" step="any" placeholder="-74.0060" value={birthData.longitude}
                onChange={(e) => setBirthData({ ...birthData, longitude: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saveMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save & Calculate
              </button>
              {editing && (
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900">
                  Cancel
                </button>
              )}
            </div>
            {saveError && (
              <p className="text-red-500 text-sm">{saveError}</p>
            )}
          </div>
        </div>
      )}

      {astroData?.hasBirthData && !editing && (
        <>
          {astroData.birthData?.birthTimeUnknown && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Birth time unknown</p>
                  <p className="mt-1">Your Rising Sign and house placements may not be accurate. The Moon sign shown is based on noon - if the Moon changed signs on your birth day, you may resonate with a different Moon sign.</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {astroData.planets?.sun && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Sun className="h-6 w-6 text-yellow-500" />
                  <h3 className="font-semibold text-gray-900">Sun Sign</h3>
                </div>
                <p className="text-2xl font-serif text-indigo-900">{astroData.planets.sun.sign}</p>
                <p className="text-sm text-gray-500 mt-1">Your core identity and purpose</p>
              </div>
            )}
            {astroData.planets?.moon && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Moon className="h-6 w-6 text-gray-400" />
                  <h3 className="font-semibold text-gray-900">Moon Sign</h3>
                  {astroData.birthData?.birthTimeUnknown && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Approximate</span>
                  )}
                </div>
                <p className="text-2xl font-serif text-indigo-900">
                  {astroData.birthData?.selectedMoonSign || astroData.planets.moon.sign}
                </p>
                <p className="text-sm text-gray-500 mt-1">Your emotional nature</p>
                {astroData.birthData?.birthTimeUnknown && astroData.possibleMoonSigns && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Moon may have been in:</p>
                    <div className="flex gap-2">
                      {astroData.possibleMoonSigns.map((sign) => (
                        <button
                          key={sign}
                          onClick={() => {/* Would need mutation to update */}}
                          className={`text-xs px-2 py-1 rounded ${
                            (astroData.birthData?.selectedMoonSign || astroData.planets.moon.sign) === sign
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {sign}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {astroData.ascendant && (
              <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${astroData.birthData?.birthTimeUnknown ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3 mb-3">
                  <Stars className="h-6 w-6 text-indigo-500" />
                  <h3 className="font-semibold text-gray-900">Rising Sign</h3>
                  {astroData.birthData?.birthTimeUnknown && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Requires exact time</span>
                  )}
                </div>
                <p className="text-2xl font-serif text-indigo-900">{astroData.ascendant.sign}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {astroData.birthData?.birthTimeUnknown
                    ? 'Birth time needed for accurate Rising Sign'
                    : 'How others see you'}
                </p>
              </div>
            )}
          </div>

          {(astroData.vsp || astroData.marsPhase) && (
            <div className="grid gap-6 md:grid-cols-2">
              {astroData.vsp && (
                <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-6 border border-pink-100">
                  <h3 className="font-semibold text-gray-900 mb-2">Venus Star Point</h3>
                  <p className="text-xl font-serif text-purple-900">{astroData.vsp.sign}</p>
                  {astroData.vsp.gift && (
                    <p className="text-sm text-gray-600 mt-2">{astroData.vsp.gift}</p>
                  )}
                </div>
              )}
              {astroData.marsPhase && (
                <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 border border-red-100">
                  <h3 className="font-semibold text-gray-900 mb-2">Mars Phase</h3>
                  <p className="text-xl font-serif text-red-900">{astroData.marsPhase.phase}</p>
                  {astroData.marsPhase.meaning && (
                    <p className="text-sm text-gray-600 mt-2">{astroData.marsPhase.meaning}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {ikigaiData && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Ikigai Analysis</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {ikigaiData.passion && (
                  <div className="p-4 bg-rose-50 rounded-lg">
                    <h4 className="font-medium text-rose-900">What You Love</h4>
                    <p className="text-sm text-rose-700 mt-1">{ikigaiData.passion.primaryInsight}</p>
                  </div>
                )}
                {ikigaiData.vocation && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900">What You're Good At</h4>
                    <p className="text-sm text-blue-700 mt-1">{ikigaiData.vocation.primaryInsight}</p>
                  </div>
                )}
                {ikigaiData.mission && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900">What The World Needs</h4>
                    <p className="text-sm text-green-700 mt-1">{ikigaiData.mission.primaryInsight}</p>
                  </div>
                )}
                {ikigaiData.profession && (
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <h4 className="font-medium text-amber-900">What You Can Be Paid For</h4>
                    <p className="text-sm text-amber-700 mt-1">{ikigaiData.profession.primaryInsight}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <button onClick={() => setEditing(true)} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
            Update birth data
          </button>
        </>
      )}
    </div>
  )
}
