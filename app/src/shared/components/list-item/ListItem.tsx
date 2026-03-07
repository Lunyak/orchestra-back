import cn from 'classnames'
import React from 'react'
import './style.css'

interface ListItemProps {
    children: React.ReactNode
    className?: string
    draggable?: boolean
    onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void
    onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void
    onDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void
    onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void
    onDrop?: (event: React.DragEvent<HTMLDivElement>) => void
    onDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
}

export const ListItem = ({ children, className, draggable, onDragStart, onDragOver, onDragEnter, onDragLeave, onDrop, onDragEnd, onClick }: ListItemProps) => {
    return (
        <div className={cn('list-item', className)} draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={onDrop} onDragEnd={onDragEnd} onClick={onClick}>
            {children}
        </div>
    )
}
