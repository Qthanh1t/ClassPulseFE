import { Button, Tooltip } from 'antd';

interface CtrlBtnProps {
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export default function CtrlBtn({ active, danger, onClick, title, icon, children, className }: CtrlBtnProps) {
  return (
    <Tooltip title={title}>
      <Button
        shape={children ? 'round' : 'circle'}
        type={active ? 'primary' : 'default'}
        danger={danger}
        icon={icon}
        className={className}
        onClick={onClick}
        style={
          !active && !danger
            ? { background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#fff' }
            : {}
        }
      >
        {children}
      </Button>
    </Tooltip>
  );
}
