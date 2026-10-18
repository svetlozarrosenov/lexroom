export type Lawyer = {
  id: string;
  name: string;
  title: string;
};

export type AvatarProps = {
  lawyers: Lawyer[];
  selectedId: string;
  onSelect: (id: string) => void;
};
