import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { lostFoundService } from '../../services/lostFoundService';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../../utils/toast';
import './LostFound.css';

const LostFound = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [acceptedLostPets, setAcceptedLostPets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [mapInitialized, setMapInitialized] = useState(false);
    const [formErrors, setFormErrors] = useState({});
    const [showContactModal, setShowContactModal] = useState(false);
    const [selectedFoundPet, setSelectedFoundPet] = useState(null);

    const [formData, setFormData] = useState({
        report_type: 'lost',
        pet_name: '',
        pet_type: '',
        breed: '',
        color: '',
        location: '',
        date_lost_found: new Date().toISOString().split('T')[0],
        contact_phone: user?.phone || '',
        contact_email: user?.email || '',
        description: '',
        latitude: null,
        longitude: null,
        matched_lost_pet_id: ''
    });

    const [imageFile, setImageFile] = useState(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const mapInstanceRef = useRef(null);

    useEffect(() => {
        loadReports();
        loadAcceptedLostPets();
        loadLeaflet();
        fetchUserPhone(); // Fetch phone from profile

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Fetch phone from user profile
    const fetchUserPhone = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('phone')
                .eq('id', user.id)
                .single();

            if (!error && data?.phone) {
                setFormData(prev => ({ ...prev, contact_phone: data.phone }));
            }
        } catch (err) {
            console.log('Could not auto-fill phone');
        }
    };

    const loadLeaflet = () => {
        if (window.L) {
            initMap();
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.3/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.3/dist/leaflet.js';
        script.onload = () => {
            initMap();
        };
        document.body.appendChild(script);
    };

    const initMap = () => {
        if (!mapRef.current || mapInitialized || !window.L) return;
        const map = window.L.map(mapRef.current).setView([15.3647, 75.1240], 12);
        mapInstanceRef.current = map;
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
        map.on('click', function (e) { setMarker(e.latlng.lat, e.latlng.lng); });
        setMapInitialized(true);
        setTimeout(() => { map.invalidateSize(); }, 200);
    };

    const setMarker = (lat, lng) => {
        if (!mapInstanceRef.current) return;
        if (markerRef.current) mapInstanceRef.current.removeLayer(markerRef.current);
        markerRef.current = window.L.marker([lat, lng]).addTo(mapInstanceRef.current);
        setFormData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            location: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`
        }));
    };

    const useGPS = (e) => {
        e.preventDefault();
        if (!navigator.geolocation) {
            showToast('GPS not supported on this device', 'error');
            return;
        }

        showToast('Fetching location...', 'info');

        const successCallback = (pos) => {
            const { latitude, longitude } = pos.coords;
            if (mapInstanceRef.current) {
                mapInstanceRef.current.setView([latitude, longitude], 15);
                setMarker(latitude, longitude);
                showToast('Location found!', 'success');
            }
        };

        const errorCallback = (error) => {
            // Try low accuracy as fallback
            if (error.code === error.POSITION_UNAVAILABLE) {
                navigator.geolocation.getCurrentPosition(
                    successCallback,
                    () => {
                        showToast('Location unavailable. Please click on the map to set location.', 'error');
                    },
                    { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
                );
                return;
            }

            switch (error.code) {
                case error.PERMISSION_DENIED:
                    showToast('Location access denied. Please enable location in browser settings, then refresh.', 'error');
                    break;
                case error.TIMEOUT:
                    showToast('Location request timed out. Try clicking on the map instead.', 'error');
                    break;
                default:
                    showToast('Unable to fetch location. Please click on the map to set location.', 'error');
            }
        };

        navigator.geolocation.getCurrentPosition(
            successCallback,
            errorCallback,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    const loadReports = async () => {
        try {
            setLoading(true);
            const data = await lostFoundService.getReports();
            setReports(data || []);
        } catch (error) {
            console.error('Error loading reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAcceptedLostPets = async () => {
        try {
            const data = await lostFoundService.getAcceptedLostPets();
            setAcceptedLostPets(data || []);
        } catch (error) {
            console.error('Error loading accepted lost pets:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleFileChange = (e) => {
        setImageFile(e.target.files[0]);
        if (formErrors.image) {
            setFormErrors(prev => ({ ...prev, image: null }));
        }
    };

    const validateForm = () => {
        const errors = {};

        if (formData.report_type === 'lost') {
            if (!formData.pet_name?.trim()) errors.pet_name = 'Pet name is required';
            if (!formData.pet_type) errors.pet_type = 'Pet type is required';
            if (!formData.color?.trim()) errors.color = 'Color is required';
            if (!formData.location?.trim()) errors.location = 'Location is required';
            if (!formData.date_lost_found) errors.date_lost_found = 'Date is required';
            if (!formData.contact_phone?.trim()) errors.contact_phone = 'Phone number is required';
            if (!formData.contact_email?.trim()) errors.contact_email = 'Email is required';
            if (!imageFile) errors.image = 'Image is required for lost pet reports';
        } else {
            // Found pet validation
            if (!formData.location?.trim()) errors.location = 'Location where you found the pet is required';
            if (!formData.contact_phone?.trim()) errors.contact_phone = 'Your phone number is required';
            if (!formData.contact_email?.trim()) errors.contact_email = 'Your email is required';

            // Image is MANDATORY if pet is NOT in the list
            if (!formData.matched_lost_pet_id && !imageFile) {
                errors.image = 'Image is required for unlisted found pets';
            }

            if (!formData.matched_lost_pet_id && !formData.description?.trim()) {
                errors.description = 'Please describe the pet you found';
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Require login to submit reports
        if (!user) {
            showToast('Please login to submit a report', 'error');
            return;
        }

        if (!validateForm()) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        try {
            setSubmitting(true);

            if (formData.report_type === 'found') {
                await lostFoundService.submitFoundReport(
                    formData,
                    imageFile,
                    formData.matched_lost_pet_id || null
                );

                if (formData.matched_lost_pet_id) {
                    showToast('Found pet report submitted! The original owner has been notified.', 'success');
                } else {
                    showToast('Found pet report submitted successfully!', 'success');
                }
            } else {
                await lostFoundService.submitReport(formData, imageFile);
                showToast('Lost pet report submitted! It will be reviewed by admin.', 'success');
            }

            setFormData({
                report_type: formData.report_type,
                pet_name: '',
                pet_type: '',
                breed: '',
                color: '',
                location: '',
                date_lost_found: new Date().toISOString().split('T')[0],
                contact_phone: user?.phone || '',
                contact_email: user?.email || '',
                description: '',
                latitude: null,
                longitude: null,
                matched_lost_pet_id: ''
            });
            setImageFile(null);
            setFormErrors({});
            if (markerRef.current && mapInstanceRef.current) {
                mapInstanceRef.current.removeLayer(markerRef.current);
                markerRef.current = null;
            }
            loadReports();
        } catch (error) {
            console.error('Error submitting report:', error);
            showToast('Failed to submit report. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    const isLostForm = formData.report_type === 'lost';

    return (
        <div className="lf-page">
            <header className="lf-hero">
                <div className="lf-hero-content">
                    <h1>Lost & Found Center</h1>
                    <p>Help reunite pets with their families.</p>
                </div>
            </header>

            <main className="lf-container">
                <section className="lf-form-section">
                    <div className="lf-card form-card">
                        <div className="card-header centered-header">
                            <h2>Submit a Report</h2>
                            <p>Fill in the details below to alert the community.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="lf-form">
                            <div className="form-group toggle-group">
                                <label className={`toggle-btn ${isLostForm ? 'active lost' : ''}`}>
                                    <input
                                        type="radio"
                                        name="report_type"
                                        value="lost"
                                        checked={isLostForm}
                                        onChange={handleInputChange}
                                    />
                                    Lost Pet
                                </label>
                                <label className={`toggle-btn ${!isLostForm ? 'active found' : ''}`}>
                                    <input
                                        type="radio"
                                        name="report_type"
                                        value="found"
                                        checked={!isLostForm}
                                        onChange={handleInputChange}
                                    />
                                    Found Pet
                                </label>
                            </div>

                            {isLostForm && (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Pet Name *</label>
                                        <input
                                            type="text"
                                            name="pet_name"
                                            value={formData.pet_name}
                                            onChange={handleInputChange}
                                            className={`lf-input ${formErrors.pet_name ? 'error' : ''}`}
                                            placeholder="Enter pet name"
                                        />
                                        {formErrors.pet_name && <span className="error-text">{formErrors.pet_name}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Type *</label>
                                        <select
                                            name="pet_type"
                                            value={formData.pet_type}
                                            onChange={handleInputChange}
                                            className={`lf-input ${formErrors.pet_type ? 'error' : ''}`}
                                        >
                                            <option value="">Select...</option>
                                            <option value="dog">Dog</option>
                                            <option value="cat">Cat</option>
                                            <option value="bird">Bird</option>
                                            <option value="rabbit">Rabbit</option>
                                            <option value="other">Other</option>
                                        </select>
                                        {formErrors.pet_type && <span className="error-text">{formErrors.pet_type}</span>}
                                    </div>
                                </div>
                            )}

                            {!isLostForm && (
                                <>
                                    <div className="form-group" style={{ background: '#f0f9ff', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #0369a1' }}>
                                        <label style={{ fontWeight: '700', color: '#0369a1', fontSize: '1.1rem' }}>
                                            Did you find a lost pet from our list? (Optional)
                                        </label>
                                        <select
                                            name="matched_lost_pet_id"
                                            value={formData.matched_lost_pet_id}
                                            onChange={handleInputChange}
                                            className="lf-input"
                                            style={{ marginTop: '0.5rem' }}
                                        >
                                            <option value="">-- Not sure / Pet not listed --</option>
                                            {acceptedLostPets.length === 0 ? (
                                                <option disabled>No active lost pet reports available</option>
                                            ) : (
                                                acceptedLostPets.map(pet => (
                                                    <option key={pet.id} value={pet.id}>
                                                        {pet.pet_name || 'Unknown'} - {pet.pet_type} - {pet.color || 'N/A'} - Lost: {formatDate(pet.date_lost_found)} - {pet.location?.substring(0, 30)}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                        <small style={{ color: '#64748b', marginTop: '0.75rem', display: 'block' }}>
                                            {formData.matched_lost_pet_id
                                                ? 'The original owner will be automatically notified with your contact details.'
                                                : 'If the pet isn\'t listed, describe it below and we\'ll help find the owner.'}
                                        </small>
                                    </div>
                                </>
                            )}

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Date {isLostForm ? 'Lost' : 'Found'} *</label>
                                    <input
                                        type="date"
                                        name="date_lost_found"
                                        value={formData.date_lost_found}
                                        onChange={handleInputChange}
                                        className={`lf-input ${formErrors.date_lost_found ? 'error' : ''}`}
                                    />
                                    {formErrors.date_lost_found && <span className="error-text">{formErrors.date_lost_found}</span>}
                                </div>
                                {isLostForm && (
                                    <div className="form-group">
                                        <label>Breed</label>
                                        <input
                                            type="text"
                                            name="breed"
                                            value={formData.breed}
                                            onChange={handleInputChange}
                                            className="lf-input"
                                            placeholder="Enter breed"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="form-group map-wrapper">
                                <div className="map-header">
                                    <label>Location *</label>
                                    <button onClick={useGPS} className="gps-btn-themed">Use GPS</button>
                                </div>
                                <input
                                    type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleInputChange}
                                    className={`lf-input location-input ${formErrors.location ? 'error' : ''}`}
                                    placeholder="Click on map or type area"
                                />
                                {formErrors.location && <span className="error-text">{formErrors.location}</span>}
                                <div id="leaflet-map" ref={mapRef}></div>
                                <small className="map-help">Click on the map to pin the exact location.</small>
                            </div>

                            <div className="form-group">
                                <label>Description {!isLostForm && !formData.matched_lost_pet_id ? '*' : ''}</label>
                                <textarea
                                    name="description"
                                    rows="3"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    className={`lf-input ${formErrors.description ? 'error' : ''}`}
                                    placeholder="Distinguishing marks, collar details..."
                                ></textarea>
                                {formErrors.description && <span className="error-text">{formErrors.description}</span>}
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Upload Photo {isLostForm || !formData.matched_lost_pet_id ? '*' : ''}</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className={`lf-file-input ${formErrors.image ? 'error' : ''}`}
                                    />
                                    {formErrors.image && <span className="error-text">{formErrors.image}</span>}
                                    {!isLostForm && formData.matched_lost_pet_id && (
                                        <small style={{ color: '#059669', display: 'block', marginTop: '0.5rem' }}>
                                            Image is optional since you selected a listed pet
                                        </small>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Color {isLostForm ? '*' : ''}</label>
                                    <input
                                        type="text"
                                        name="color"
                                        value={formData.color}
                                        onChange={handleInputChange}
                                        className={`lf-input ${formErrors.color ? 'error' : ''}`}
                                        placeholder="Enter color"
                                    />
                                    {formErrors.color && <span className="error-text">{formErrors.color}</span>}
                                </div>
                            </div>

                            <div className="form-group contact-info">
                                <h4>Contact Details</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <input
                                            type="tel"
                                            name="contact_phone"
                                            value={formData.contact_phone}
                                            onChange={handleInputChange}
                                            placeholder="Enter phone number"
                                            className={`lf-input ${formErrors.contact_phone ? 'error' : ''}`}
                                        />
                                        {formErrors.contact_phone && <span className="error-text">{formErrors.contact_phone}</span>}
                                    </div>
                                    <div className="form-group">
                                        <input
                                            type="email"
                                            name="contact_email"
                                            value={formData.contact_email}
                                            onChange={handleInputChange}
                                            placeholder="Enter email address"
                                            className={`lf-input ${formErrors.contact_email ? 'error' : ''}`}
                                        />
                                        {formErrors.contact_email && <span className="error-text">{formErrors.contact_email}</span>}
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="lf-submit-btn" disabled={submitting}>
                                {submitting ? 'Submitting...' : 'Post Report'}
                            </button>
                        </form>
                    </div>
                </section>

                <section className="lf-list-section">
                    <div className="section-header centered-header">
                        <h2>Recent Alerts</h2>
                        <div className="header-divider"></div>
                    </div>

                    {loading ? (
                        <div className="lf-loading">Loading alerts...</div>
                    ) : reports.length === 0 ? (
                        <div className="lf-empty">No active reports.</div>
                    ) : (
                        <div className="lf-grid">
                            {reports.filter(r => r.status === 'approved').map((report) => (
                                <div key={report.id} className="lf-report-card">
                                    <div className={`lf-badge ${report.report_type}`}>
                                        {report.report_type === 'lost' ? 'LOST' : 'FOUND'}
                                    </div>

                                    <div className="lf-img-container">
                                        {report.image_url ? (
                                            <img src={report.image_url} alt={report.pet_name} onError={(e) => e.target.style.display = 'none'} />
                                        ) : (
                                            <div className="lf-no-img">No Image</div>
                                        )}
                                    </div>

                                    <div className="lf-content">
                                        <h3>{report.pet_name || 'Unknown Pet'}</h3>
                                        <p className="lf-meta">
                                            <span>{formatDate(report.date_lost_found)}</span>
                                            <span>{report.location?.substring(0, 25)}...</span>
                                        </p>

                                        <div className="lf-details">
                                            <span className="pill">{report.pet_type}</span>
                                            {report.breed && <span className="pill">{report.breed}</span>}
                                        </div>

                                        <p className="lf-desc">"{report.description || 'No description provided.'}"</p>

                                        <div className="lf-contact-box">
                                            <strong>Contact:</strong>
                                            <a href={`tel:${report.contact_phone}`}>{report.contact_phone}</a>
                                        </div>

                                        {/* "I am the owner" button for FOUND pets */}
                                        {report.report_type === 'found' && !report.matched_lost_pet_id && (
                                            <div style={{
                                                marginTop: '1rem',
                                                padding: '1rem',
                                                background: '#FEE2E2',
                                                border: '2px solid #DC2626',
                                                borderRadius: '8px'
                                            }}>
                                                <p style={{
                                                    margin: '0 0 0.75rem 0',
                                                    fontSize: '0.9rem',
                                                    color: '#991B1B',
                                                    fontWeight: '600'
                                                }}>
                                                    Is this your pet?
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        setSelectedFoundPet(report);
                                                        setShowContactModal(true);
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.75rem',
                                                        background: '#DC2626',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer',
                                                        fontSize: '1rem'
                                                    }}
                                                    onMouseOver={(e) => e.target.style.background = '#B91C1C'}
                                                    onMouseOut={(e) => e.target.style.background = '#DC2626'}
                                                >
                                                    🐾 I am the owner!
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            {/* Contact Modal for Found Pet Claiming */}
            {showContactModal && selectedFoundPet && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        background: 'white',
                        padding: '2rem',
                        borderRadius: '16px',
                        maxWidth: '500px',
                        width: '90%'
                    }}>
                        <h2 style={{ margin: '0 0 1rem 0', color: '#1F2937' }}>Finder's Contact Details</h2>
                        <p style={{ margin: '0 0 1.5rem 0', color: '#6B7280' }}>
                            Here are the contact details of the person who found your pet:
                        </p>

                        <div style={{
                            background: '#F3F4F6',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            marginBottom: '1.5rem'
                        }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <strong style={{ color: '#374151' }}>📞 Phone:</strong>
                                <div style={{ marginTop: '0.5rem' }}>
                                    <a href={`tel:${selectedFoundPet.contact_phone}`} style={{
                                        color: '#DC2626',
                                        fontSize: '1.25rem',
                                        fontWeight: 'bold',
                                        textDecoration: 'none'
                                    }}>
                                        {selectedFoundPet.contact_phone}
                                    </a>
                                </div>
                            </div>
                            <div>
                                <strong style={{ color: '#374151' }}>✉️ Email:</strong>
                                <div style={{ marginTop: '0.5rem' }}>
                                    <a href={`mailto:${selectedFoundPet.contact_email}`} style={{
                                        color: '#DC2626',
                                        fontSize: '1.1rem',
                                        fontWeight: 'bold',
                                        textDecoration: 'none'
                                    }}>
                                        {selectedFoundPet.contact_email}
                                    </a>
                                </div>
                            </div>
                        </div>

                        <p style={{
                            fontSize: '0.9rem',
                            color: '#6B7280',
                            marginBottom: '1.5rem',
                            background: '#FEF3C7',
                            padding: '0.75rem',
                            borderRadius: '8px'
                        }}>
                            Please contact them to arrange pickup. This listing will be removed from the community.
                        </p>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => {
                                    setShowContactModal(false);
                                    setSelectedFoundPet(null);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: '#F3F4F6',
                                    color: '#374151',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        // Mark as claimed and remove from community
                                        await supabase
                                            .from('lost_found_pets')
                                            .update({ status: 'claimed' })
                                            .eq('id', selectedFoundPet.id);

                                        showToast('Pet claimed! Contact has been shared.', 'success');
                                        setShowContactModal(false);
                                        setSelectedFoundPet(null);
                                        loadReports(); // Refresh to remove from community
                                    } catch (error) {
                                        showToast('Failed to claim pet', 'error');
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: '#10B981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                ✓ Got it, Remove from Community
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LostFound;
