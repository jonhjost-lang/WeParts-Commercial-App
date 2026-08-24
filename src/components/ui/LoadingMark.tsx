import loadingRed from '../../assets/loadVermelho.svg';

interface LoadingMarkProps {
  compact?: boolean;
}

export default function LoadingMark({ compact = false }: LoadingMarkProps) {
  return (
    <img
      className={`loading-brand-mark${compact ? ' compact' : ''}`}
      src={loadingRed}
      alt=""
      aria-hidden="true"
    />
  );
}
