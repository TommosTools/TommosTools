export type MemoSlot			= { sourceValues: unknown[], tag: unknown, out: unknown };
export type MemoSlotIterator	= { next(): MemoSlot };

export class MemoSlotProvider
{
	private slots: MemoSlot[] = [];

	iterator(): MemoSlotIterator
	{
		let	i = 0;

		const { slots } = this;

		return {
			next(): MemoSlot
			{
				if (i >= slots.length)
					slots.push({ sourceValues: [], tag: undefined, out: undefined });

				return slots[i++];	// eslint-disable-line no-plusplus
			},
		};
	}
}