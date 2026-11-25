import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import EthiopianChildHome from '../../components/child/EthiopianChildHome';

export default function ChildDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [recommendationNotice, setRecommendationNotice] = useState('');
  const [startingRecommendationId, setStartingRecommendationId] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axiosClient.get('/child/dashboard');
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Please log in to continue');
      } else {
        setError(err.response?.data?.error || 'We could not load your learning space. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const startRecommendation = async (recommendation) => {
    setStartingRecommendationId(recommendation.id);
    setRecommendationNotice('');
    try {
      const { data: result } = await axiosClient.post(`/child/recommendations/${recommendation.id}/start`);
      if (!result.lesson_id) throw new Error('The lesson could not be opened. Please try another learning step.');
      navigate(`/child/lessons/${result.lesson_id}`);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'RECOMMENDATION_UNAVAILABLE') {
        setRecommendationNotice(err.response.data.error || 'We found another learning step for you.');
        await fetchDashboard();
      } else {
        setRecommendationNotice(err.response?.data?.error || err.message || 'The lesson could not be opened. Please try again.');
      }
    } finally {
      setStartingRecommendationId(null);
    }
  };

  return <EthiopianChildHome
    data={data}
    loading={loading}
    error={error}
    onRetry={fetchDashboard}
    onStartRecommendation={startRecommendation}
    startingRecommendationId={startingRecommendationId}
    recommendationNotice={recommendationNotice}
  />;
}
