import PropTypes from 'prop-types';
import InfoCard from './InfoCard';

function LabelsInfo({ positiveChipCount, negativeChipCount, polygonCount }) {
  return (
    <InfoCard title="Labels">
      <span className="label-stat positive">{positiveChipCount} pos</span>
      <span className="label-stat separator">·</span>
      <span className="label-stat negative">{negativeChipCount} neg</span>
      <span className="label-stat separator">·</span>
      <span className="label-stat">{polygonCount} polygons</span>
    </InfoCard>
  );
}

LabelsInfo.propTypes = {
  positiveChipCount: PropTypes.number.isRequired,
  negativeChipCount: PropTypes.number.isRequired,
  polygonCount: PropTypes.number.isRequired,
};

export default LabelsInfo;
